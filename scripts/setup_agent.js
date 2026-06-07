// scripts/setup_agent.js
// Setup Assistant Script for Google Cloud Agent Builder / Dialogflow CX

const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('===================================================');
console.log('🤖 WORLD CUP 2026 ELO ANALYST - GOOGLE AGENT BUILDER SETUP');
console.log('===================================================\n');

console.log('This script will guide you step-by-step through setting up');
console.log('Google Cloud Agent Builder (Vertex AI Search and Conversation / Dialogflow CX).\n');

const steps = [
  {
    title: 'STEP 1: Enable Google Cloud APIs',
    instructions: [
      '1. Open Google Cloud Console: https://console.cloud.google.com',
      '2. Create a new project or select an existing one.',
      '3. Enable the Dialogflow API:',
      '   Go to https://console.cloud.google.com/apis/library/dialogflow.googleapis.com',
      '   and click "Enable".',
      '4. Enable the Vertex AI API:',
      '   Go to https://console.cloud.google.com/apis/library/aiplatform.googleapis.com',
      '   and click "Enable".'
    ]
  },
  {
    title: 'STEP 2: Create a Search Data Store (for ELO json data)',
    instructions: [
      '1. Go to Agent Builder Console: https://console.cloud.google.com/gen-app-builder',
      '2. Click "Data Stores" in the left sidebar and click "Create Data Store".',
      '3. Select "Cloud Storage" or "BigQuery" or upload your `elo_ratings_wc2026.json` data.',
      '   Note: You can convert your JSON data into a format suitable for the Data Store.',
      '4. Name your data store: e.g., `worldcup-elo-datastore`.'
    ]
  },
  {
    title: 'STEP 3: Create your Vertex AI Agent',
    instructions: [
      '1. Go back to the Agent Builder Console home page.',
      '2. Click "Create App" or "Create Agent".',
      '3. Choose "Search" or "Chat" (Vertex AI Agent).',
      '4. Give the agent a name: e.g., "World Cup 2026 ELO Analyst".',
      '5. Connect the Data Store you created in Step 2 to this Agent.',
      '6. Once created, copy the "Agent ID". You can find this in the agent settings or URL.',
      '   The URL format is usually: .../agents/YOUR_AGENT_ID/...'
    ]
  },
  {
    title: 'STEP 4: Create and Download a Service Account Key',
    instructions: [
      '1. Go to Service Accounts page in Google Cloud Console:',
      '   https://console.cloud.google.com/iam-admin/serviceaccounts',
      '2. Click "+ Create Service Account".',
      '3. Name it `dialogflow-client-agent` and click "Create and Continue".',
      '4. Grant the following roles to the service account:',
      '   - "Dialogflow API Client" (or "Dialogflow API Reader")',
      '   - "Discovery Engine Admin" (or "Discovery Engine Viewer")',
      '5. Click "Done".',
      '6. Click on the newly created service account, go to the "Keys" tab.',
      '7. Click "Add Key" -> "Create new key". Select "JSON" and click "Create".',
      '8. Save the downloaded JSON file to: keys/google-key.json'
    ]
  },
  {
    title: 'STEP 5: Verify Your Configuration (.env)',
    instructions: [
      'Check that your `.env` file contains the correct values:',
      `- GOOGLE_CLOUD_PROJECT="${process.env.GOOGLE_CLOUD_PROJECT || 'your-google-project-id'}"`,
      `- GOOGLE_AGENT_ID="${process.env.GOOGLE_AGENT_ID || 'your-agent-id'}"`,
      `- GOOGLE_LOCATION="${process.env.GOOGLE_LOCATION || 'us-central1'}"`,
      `- GOOGLE_APPLICATION_CREDENTIALS="${process.env.GOOGLE_APPLICATION_CREDENTIALS || './keys/google-key.json'}"`,
      `- USE_AGENT_BUILDER="${process.env.USE_AGENT_BUILDER || 'true'}"`
    ]
  }
];

steps.forEach((step) => {
  console.log(`\n--- ${step.title} ---`);
  step.instructions.forEach(line => console.log(`  ${line}`));
});

console.log('\n===================================================');
console.log('🔍 CURRENT STATUS CHECK');
console.log('===================================================');

// Check keys/ folder and google-key.json
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './keys/google-key.json';
const absoluteKeyPath = path.resolve(keyPath);

if (fs.existsSync(absoluteKeyPath)) {
  console.log(`✅ Credentials file found at: ${keyPath}`);
  try {
    const keyData = JSON.parse(fs.readFileSync(absoluteKeyPath, 'utf8'));
    console.log(`   - Project ID in JSON: ${keyData.project_id}`);
    console.log(`   - Client Email: ${keyData.client_email}`);
  } catch (e) {
    console.log(`❌ Credentials file found but it is not valid JSON: ${e.message}`);
  }
} else {
  console.log(`⚠️  Credentials file NOT found at: ${keyPath}`);
  console.log(`   Please ensure your JSON credentials are downloaded and placed in the "keys/" folder.`);
}

// Check env variables
const project = process.env.GOOGLE_CLOUD_PROJECT;
const agentId = process.env.GOOGLE_AGENT_ID;

if (project && agentId && agentId !== 'your-agent-id') {
  console.log(`✅ Env settings verified: Project ID: ${project}, Agent ID: ${agentId}`);
} else {
  console.log('⚠️  Env variables missing or incomplete:');
  if (!project || project === 'your-google-project-id') console.log('   - GOOGLE_CLOUD_PROJECT is not set correctly');
  if (!agentId || agentId === 'your-agent-id') console.log('   - GOOGLE_AGENT_ID is not set correctly');
}

console.log('\nOnce all steps are complete, start your server:');
console.log('  npm run start  (or npm run dev)');
console.log('===================================================\n');
