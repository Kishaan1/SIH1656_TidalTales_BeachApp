import assert from 'node:assert';
import { evaluateSuitability, SuitabilityStatus, haversineDistanceKm, kmphToKnots } from '../src/suitability.js';

console.log('--- Running Tidal Tales Master Suitability Algorithm Unit Tests ---');

// Test 1: Ideal conditions (<1.2m wave, <15 kts wind, <12s swell, high water quality) => Safe to Swim
{
  const reading = {
    waveHeightM: 0.8,
    windSpeedKnots: 10,
    swellPeriodSec: 6,
    waterQualityIndex: 90,
  };
  const result = evaluateSuitability(reading);
  assert.strictEqual(result.status, SuitabilityStatus.SAFE, 'Ideal conditions must yield Safe to Swim');
  assert.ok(result.score >= 80, `Score ${result.score} should be >= 80`);
  console.log('✓ Test 1 Passed: Ideal conditions => Safe to Swim (' + result.score + '/100)');
}

// Test 2: Moderate conditions (1.5m wave, 17 kts wind) => Caution Advised
{
  const reading = {
    waveHeightM: 1.5,
    windSpeedKnots: 17,
    swellPeriodSec: 11,
    waterQualityIndex: 60,
  };
  const result = evaluateSuitability(reading);
  assert.strictEqual(result.status, SuitabilityStatus.MODERATE, 'Moderate conditions must yield Caution Advised');
  assert.ok(result.score >= 40 && result.score < 70, `Score ${result.score} should be 40-70`);
  console.log('✓ Test 2 Passed: Moderate conditions => Caution Advised (' + result.score + '/100)');
}

// Test 3: Hazardous waves (>2.0m) and long swell (>14s) => Hazardous
{
  const reading = {
    waveHeightM: 2.5,
    windSpeedKnots: 22,
    swellPeriodSec: 16,
    waterQualityIndex: 50,
  };
  const result = evaluateSuitability(reading);
  assert.strictEqual(result.status, SuitabilityStatus.UNSAFE, 'Heavy seas must yield Hazardous');
  assert.ok(result.score < 40, `Score ${result.score} should be < 40`);
  console.log('✓ Test 3 Passed: Hazardous ocean state => Hazardous (' + result.score + '/100)');
}

// Test 4: Hard Safety Override (High Wave Warning) => Forced 0 & Hazardous
{
  const reading = {
    waveHeightM: 0.4, // calm
    windSpeedKnots: 5,
    swellPeriodSec: 5,
    waterQualityIndex: 100,
    highWaveAlert: true,
  };
  const result = evaluateSuitability(reading);
  assert.strictEqual(result.status, SuitabilityStatus.UNSAFE, 'Active high wave alert must force Hazardous');
  assert.strictEqual(result.score, 0, 'Score must be forced to 0');
  assert.ok(result.isHazardOverride, 'isHazardOverride flag must be true');
  console.log('✓ Test 4 Passed: Hard Safety Override => Forced 0 / Hazardous');
}

// Test 5: Hard Safety Override (Tsunami Alert) => Forced 0 & Hazardous
{
  const reading = {
    waveHeightM: 0.3,
    windSpeedKnots: 6,
    swellPeriodSec: 6,
    waterQualityIndex: 95,
    tsunamiAlert: true,
  };
  const result = evaluateSuitability(reading);
  assert.strictEqual(result.status, SuitabilityStatus.UNSAFE);
  assert.strictEqual(result.score, 0);
  assert.ok(result.reasons[0].includes('Tsunami'));
  console.log('✓ Test 5 Passed: Tsunami alert override => Forced 0 / Hazardous');
}

// Test 6: Unit conversion check
{
  const knots = kmphToKnots(18.52);
  assert.strictEqual(knots, 10, '18.52 km/h must equal 10 knots');
  console.log('✓ Test 6 Passed: km/h to knots conversion verified');
}

console.log('\n🎉 ALL MASTER SUITABILITY ALGORITHM TESTS PASSED WITH 100% FIDELITY!\n');
