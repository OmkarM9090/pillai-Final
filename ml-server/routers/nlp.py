from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
import os
from services.model_loader import model_store

router = APIRouter(prefix="/api/nlp", tags=["NLP & Reviews"])

class ReviewInput(BaseModel):
    review_text: str
    guest_name: Optional[str] = "Anonymous"
    room_number: Optional[str] = ""
    source: Optional[str] = "direct"  # tripadvisor, google, direct

class ReviewAnalysis(BaseModel):
    sentiment: str
    sentiment_score: float
    sentiment_source: str = "rule_based"
    aspects: List[dict]
    issues: List[dict]
    auto_tickets: List[dict]
    keywords: List[str]

class BulkReviewInput(BaseModel):
    reviews: List[ReviewInput]

@router.post("/analyze-review", response_model=ReviewAnalysis)
async def analyze_review(review: ReviewInput):
    """Analyze a guest review using NLP - extract sentiment, aspects, and generate tickets"""
    
    text = review.review_text.lower()
    
    # --- Sentiment Analysis (rule-based, with trained LogisticRegression+TF-IDF model as tie-breaker) ---
    sentiment, score, source = _analyze_sentiment(text)
    
    # --- Aspect-Based Analysis (ABSA) ---
    aspects = _extract_aspects(text)
    
    # --- Issue Detection ---
    issues = _detect_issues(text, review.room_number)
    
    # --- Auto-generate tickets ---
    tickets = _generate_tickets(issues, review.guest_name, review.room_number)
    
    # --- Keywords ---
    keywords = _extract_keywords(text)
    
    return ReviewAnalysis(
        sentiment=sentiment,
        sentiment_score=score,
        sentiment_source=source,
        aspects=aspects,
        issues=issues,
        auto_tickets=tickets,
        keywords=keywords
    )

@router.post("/analyze-bulk")
async def analyze_bulk_reviews(data: BulkReviewInput):
    """Analyze multiple reviews at once"""
    results = []
    for review in data.reviews:
        text = review.review_text.lower()
        sentiment, score, _source = _analyze_sentiment(text)
        aspects = _extract_aspects(text)
        issues = _detect_issues(text, review.room_number)
        tickets = _generate_tickets(issues, review.guest_name, review.room_number)
        
        results.append({
            "guest": review.guest_name,
            "sentiment": sentiment,
            "score": score,
            "issues_count": len(issues),
            "tickets_generated": len(tickets),
            "aspects": aspects
        })
    
    # Summary
    sentiments = [r["sentiment"] for r in results]
    return {
        "total_reviews": len(results),
        "sentiment_breakdown": {
            "positive": sentiments.count("positive"),
            "neutral": sentiments.count("neutral"),
            "negative": sentiments.count("negative")
        },
        "avg_score": round(np.mean([r["score"] for r in results]), 2),
        "total_issues": sum(r["issues_count"] for r in results),
        "total_tickets": sum(r["tickets_generated"] for r in results),
        "reviews": results
    }

@router.get("/sample-reviews")
async def get_sample_reviews():
    """Get sample reviews for demo"""
    return {
        "reviews": [
            {
                "text": "The room was beautiful and clean, but the AC was making a rattling noise all night. Breakfast buffet was amazing though! Staff was very friendly.",
                "guest": "Rajesh Kumar",
                "room": "204"
            },
            {
                "text": "Terrible experience. Water was leaking from bathroom ceiling. Called maintenance twice but nobody came. Very disappointed.",
                "guest": "Priya Sharma", 
                "room": "312"
            },
            {
                "text": "Perfect weekend getaway! The spa was heavenly, food was delicious, and the pool area was well maintained. Will definitely come back!",
                "guest": "Amit Patel",
                "room": "108"
            },
            {
                "text": "Room service took 45 minutes. WiFi was extremely slow. The gym equipment needs updating. Location is great but service needs improvement.",
                "guest": "Sneha Desai",
                "room": "405"
            },
            {
                "text": "Average stay. Nothing special. Room was okay, food was decent. Price is a bit high for what you get. The garden area is nice.",
                "guest": "Vikram Singh",
                "room": "215"
            }
        ]
    }

# --- Helper Functions ---

def _ml_sentiment(text):
    """Real trained model inference: TF-IDF + Logistic Regression, trained on labeled review sentiment data"""
    if model_store.sentiment_model is None or model_store.tfidf_vectorizer is None:
        return None, None
    try:
        X = model_store.tfidf_vectorizer.transform([text])
        probs = model_store.sentiment_model.predict_proba(X)[0]
        classes = model_store.sentiment_model.classes_
        idx = int(probs.argmax())
        return str(classes[idx]), round(float(probs[idx]), 2)
    except Exception:
        return None, None


def _analyze_sentiment(text):
    """Keyword evidence extraction (primary, explainable) with trained ML model
    (TF-IDF + Logistic Regression) as a tie-breaker for ambiguous/neutral text."""
    positive_words = ["amazing", "beautiful", "excellent", "great", "perfect", "wonderful", 
                      "delicious", "friendly", "clean", "comfortable", "heavenly", "best",
                      "loved", "fantastic", "superb", "outstanding"]
    negative_words = ["terrible", "horrible", "worst", "dirty", "broken", "leaking", "noise",
                      "slow", "rude", "disappointed", "complaint", "poor", "bad", "awful",
                      "cold", "late", "waiting", "smell", "stain", "cockroach", "bug"]
    
    pos_count = sum(1 for w in positive_words if w in text)
    neg_count = sum(1 for w in negative_words if w in text)
    
    if pos_count > neg_count + 1:
        return "positive", round(0.7 + min(0.3, pos_count * 0.05), 2), "rule_based"
    elif neg_count > pos_count + 1:
        return "negative", round(0.3 - min(0.2, neg_count * 0.03), 2), "rule_based"
    elif neg_count > pos_count:
        return "negative", round(0.35, 2), "rule_based"
    elif pos_count > neg_count:
        return "positive", round(0.65, 2), "rule_based"
    else:
        # No decisive keyword evidence either way — defer to the trained ML model
        ml_label, ml_conf = _ml_sentiment(text)
        if ml_label:
            return ml_label, ml_conf, "ml_model"
        return "neutral", 0.50, "rule_based"

def _extract_aspects(text):
    aspect_keywords = {
        "room_quality": ["room", "bed", "pillow", "mattress", "furniture", "decor", "view"],
        "cleanliness": ["clean", "dirty", "stain", "dust", "hygiene", "spotless", "filthy"],
        "food_and_beverage": ["food", "breakfast", "dinner", "lunch", "buffet", "restaurant", "bar", "delicious", "menu"],
        "service": ["staff", "service", "friendly", "helpful", "rude", "slow", "responsive", "attentive", "manager"],
        "amenities": ["pool", "spa", "gym", "wifi", "parking", "garden", "beach"],
        "maintenance": ["ac", "air conditioning", "plumbing", "leak", "noise", "broken", "repair", "hot water"],
        "value": ["price", "expensive", "cheap", "value", "worth", "cost", "overpriced"],
        "location": ["location", "view", "nearby", "access", "transport"]
    }
    
    found_aspects = []
    for aspect, keywords in aspect_keywords.items():
        matches = [k for k in keywords if k in text]
        if matches:
            # Determine aspect sentiment
            aspect_context = text
            pos = sum(1 for w in ["good", "great", "nice", "beautiful", "amazing", "excellent", "clean", "friendly", "delicious"] if w in aspect_context)
            neg = sum(1 for w in ["bad", "poor", "terrible", "dirty", "broken", "slow", "noise", "leak", "worst"] if w in aspect_context)
            
            sentiment = "positive" if pos > neg else "negative" if neg > pos else "neutral"
            
            found_aspects.append({
                "aspect": aspect,
                "sentiment": sentiment,
                "keywords_found": matches,
                "confidence": round(0.7 + len(matches) * 0.05, 2)
            })
    
    return found_aspects

def _detect_issues(text, room_number=""):
    issues = []
    
    issue_patterns = {
        "AC_MALFUNCTION": {"keywords": ["ac", "air conditioning", "rattling", "cooling", "hot room"], "department": "maintenance", "priority": "high"},
        "WATER_LEAK": {"keywords": ["leak", "leaking", "water damage", "dripping"], "department": "maintenance", "priority": "critical"},
        "CLEANLINESS": {"keywords": ["dirty", "stain", "unclean", "dust", "cockroach", "bug", "insect"], "department": "housekeeping", "priority": "high"},
        "SLOW_SERVICE": {"keywords": ["slow", "waited", "waiting", "45 minutes", "late", "delay"], "department": "operations", "priority": "medium"},
        "WIFI_ISSUE": {"keywords": ["wifi", "internet", "slow wifi", "connection"], "department": "IT", "priority": "medium"},
        "NOISE": {"keywords": ["noise", "noisy", "loud", "disturb"], "department": "front_desk", "priority": "medium"},
        "FOOD_QUALITY": {"keywords": ["cold food", "stale", "undercooked", "taste"], "department": "fnb", "priority": "medium"},
        "EQUIPMENT": {"keywords": ["broken", "not working", "damaged", "repair", "needs updating"], "department": "maintenance", "priority": "medium"}
    }
    
    for issue_type, config in issue_patterns.items():
        matches = [k for k in config["keywords"] if k in text]
        if matches:
            issues.append({
                "type": issue_type,
                "department": config["department"],
                "priority": config["priority"],
                "evidence": matches,
                "room": room_number
            })
    
    return issues

def _generate_tickets(issues, guest_name, room_number):
    tickets = []
    for issue in issues:
        tickets.append({
            "ticket_id": f"TKT-{np.random.randint(10000,99999)}",
            "title": f"{issue['type'].replace('_', ' ').title()} - Room {room_number}",
            "department": issue["department"],
            "priority": issue["priority"],
            "status": "open",
            "reported_by": "AI Review Analysis",
            "guest": guest_name,
            "room": room_number,
            "description": f"Auto-detected from guest review: {', '.join(issue['evidence'])}",
            "source": "review_intelligence"
        })
    return tickets

def _extract_keywords(text):
    """Extract important keywords from review"""
    import re
    # Remove common words
    stop_words = {"the", "a", "an", "is", "was", "were", "be", "been", "being", "have", "has", 
                  "had", "do", "does", "did", "will", "would", "shall", "should", "may", "might",
                  "must", "can", "could", "i", "we", "you", "he", "she", "it", "they", "me",
                  "him", "her", "us", "them", "my", "your", "his", "its", "our", "their",
                  "this", "that", "these", "those", "am", "are", "and", "but", "or", "so",
                  "if", "then", "than", "too", "very", "just", "about", "up", "out", "on",
                  "in", "at", "to", "for", "of", "with", "by", "from", "as", "into", "not",
                  "no", "nor", "all", "each", "every", "both", "few", "more", "most", "other",
                  "some", "such", "only", "own", "same", "than", "also"}
    
    words = re.findall(r'\b[a-z]+\b', text)
    keywords = [w for w in words if w not in stop_words and len(w) > 3]
    
    # Get unique, preserve order
    seen = set()
    unique = []
    for w in keywords:
        if w not in seen:
            seen.add(w)
            unique.append(w)
    
    return unique[:10]
