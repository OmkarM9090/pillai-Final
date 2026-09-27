import axios from 'axios';

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:8000';

const mlClient = axios.create({
  baseURL: ML_SERVER_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

export const MLService = {
  // Forecast
  async predictDemand(params: any) {
    const { data } = await mlClient.post('/api/forecast/predict', params);
    return data;
  },

  async getWeeklyForecast() {
    const { data } = await mlClient.get('/api/forecast/weekly');
    return data;
  },

  // Simulation
  async runSimulation(scenario: any) {
    const { data } = await mlClient.post('/api/simulation/run', scenario);
    return data;
  },

  async compareScenarios(scenarioA: any, scenarioB: any) {
    const { data } = await mlClient.post('/api/simulation/compare', {
      scenario_a: scenarioA,
      scenario_b: scenarioB
    });
    return data;
  },

  async getSimulationPresets() {
    const { data } = await mlClient.get('/api/simulation/presets');
    return data;
  },

  // NLP
  async analyzeReview(review: any) {
    const { data } = await mlClient.post('/api/nlp/analyze-review', review);
    return data;
  },

  async analyzeBulkReviews(reviews: any[]) {
    const { data } = await mlClient.post('/api/nlp/analyze-bulk', { reviews });
    return data;
  },

  async getSampleReviews() {
    const { data } = await mlClient.get('/api/nlp/sample-reviews');
    return data;
  },

  // Staff
  async generateRoster(params: any) {
    const { data } = await mlClient.post('/api/staff/generate-roster', params);
    return data;
  },

  async getStaffDashboard() {
    const { data } = await mlClient.get('/api/staff/dashboard');
    return data;
  },

  // Health
  async checkHealth() {
    const { data } = await mlClient.get('/health');
    return data;
  }
};

export default MLService;
