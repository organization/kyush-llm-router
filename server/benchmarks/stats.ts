export interface BenchmarkResult {
  scenario: string;
  mode: 'direct' | 'route';
  totalRequests: number;
  successfulRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errors: number;
  throughput: number;
  totalDuration: number;
}

export interface RawResult {
  responseTime: number;
  success: boolean;
  error?: string;
}

export function calculateStats(results: RawResult[], scenario: string, mode: 'direct' | 'route'): BenchmarkResult {
  const responseTimes = results.filter(r => r.success).map(r => r.responseTime);
  const errors = results.filter(r => !r.success).length;
  const successfulRequests = responseTimes.length;
  const totalDuration = Math.max(...responseTimes, 0);
  
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  
  const avgResponseTime = sortedTimes.length > 0 
    ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length 
    : 0;
  
  const minResponseTime = sortedTimes.length > 0 ? sortedTimes[0] : 0;
  const maxResponseTime = sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0;
  
  const p50Index = Math.floor(sortedTimes.length * 0.5);
  const p95Index = Math.floor(sortedTimes.length * 0.95);
  const p99Index = Math.floor(sortedTimes.length * 0.99);
  
  const p50ResponseTime = sortedTimes.length > 0 ? sortedTimes[p50Index] || 0 : 0;
  const p95ResponseTime = sortedTimes.length > 0 ? sortedTimes[Math.min(p95Index, sortedTimes.length - 1)] || 0 : 0;
  const p99ResponseTime = sortedTimes.length > 0 ? sortedTimes[Math.min(p99Index, sortedTimes.length - 1)] || 0 : 0;
  
  const throughput = totalDuration > 0 ? (successfulRequests / totalDuration) * 1000 : 0;
  
  return {
    scenario,
    mode,
    totalRequests: results.length,
    successfulRequests,
    avgResponseTime: Math.round(avgResponseTime * 100) / 100,
    minResponseTime: Math.round(minResponseTime * 100) / 100,
    maxResponseTime: Math.round(maxResponseTime * 100) / 100,
    p50ResponseTime: Math.round(p50ResponseTime * 100) / 100,
    p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
    p99ResponseTime: Math.round(p99ResponseTime * 100) / 100,
    errors,
    throughput: Math.round(throughput * 100) / 100,
    totalDuration,
  };
}

export function calculateOverhead(direct: BenchmarkResult, route: BenchmarkResult): number {
  if (direct.avgResponseTime === 0) return 0;
  return ((route.avgResponseTime - direct.avgResponseTime) / direct.avgResponseTime) * 100;
}
