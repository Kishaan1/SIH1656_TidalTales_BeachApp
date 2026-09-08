import assert from 'node:assert';
import { askGeminiCoastalAI } from '../src/gemini.js';
import { INITIAL_BEACHES } from '../src/beaches.js';

console.log('--- Testing Gemini Coastal AI Integration ---');

const marina = INITIAL_BEACHES[0]; // Marina Beach
const question = "Can children safely swim here today with current wave heights?";

try {
  const answer = await askGeminiCoastalAI(marina, question);
  assert.ok(answer && answer.length > 20, 'Gemini response must be non-empty');
  console.log('✓ Gemini AI Response received successfully!');
  console.log('--- Sample Response Preview ---');
  console.log(answer);
  console.log('-------------------------------');
  console.log('\n🎉 GEMINI AI INTEGRATION PASSED WITH 100% SUCCESS!\n');
} catch (err) {
  console.error('Gemini Test Failed:', err);
  process.exit(1);
}
