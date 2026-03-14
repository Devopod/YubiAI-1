import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, ArrowLeft, Book, Code, Key, Zap, Globe, Copy, Check } from 'lucide-react';

const API_BASE_URL = window.location.origin;
const APP_URL = window.location.origin;

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'auth', label: 'Authentication' },
  { id: 'api-reference', label: 'API Reference' },
  { id: 'python', label: 'Python' },
  { id: 'nodejs', label: 'Node.js' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'go', label: 'Go' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
  { id: 'curl', label: 'cURL' },
  { id: 'errors', label: 'Error Handling' },
  { id: 'rate-limits', label: 'Rate Limits' },
];

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-700">
        <span className="text-xs text-zinc-400">{language}</span>
        <button onClick={handleCopy} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-zinc-300"><code>{code}</code></pre>
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="text-zinc-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-emerald-500" />
            <span className="font-semibold">YubiAI</span>
          </div>
          <span className="text-zinc-600">|</span>
          <span className="text-sm text-zinc-400">Documentation</span>
          <div className="flex-1" />
          <Link to="/chat" className="text-sm text-zinc-400 hover:text-white">Chat</Link>
          <Link to="/api-keys" className="text-sm text-zinc-400 hover:text-white">API Keys</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <div className="hidden md:block w-56 flex-shrink-0 border-r border-zinc-800 p-4 sticky top-14 h-screen overflow-y-auto">
          <p className="text-xs text-zinc-500 font-medium mb-3 uppercase tracking-wider">Contents</p>
          {sections.map((s) => (
            <button key={s.id} onClick={() => { setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}
              className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm mb-0.5 transition-colors ${activeSection === s.id ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-4xl px-6 py-8">
          {/* Overview */}
          <section id="overview" className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <Book size={24} className="text-emerald-400" />
              <h1 className="text-3xl font-bold">YubiAI Documentation</h1>
            </div>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Welcome to the YubiAI API documentation. YubiAI is a powerful AI assistant created by Devopods,
              providing intelligent conversational AI capabilities through a simple REST API.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                <Zap size={20} className="text-emerald-400 mb-2" />
                <h3 className="font-medium mb-1">Quick Setup</h3>
                <p className="text-xs text-zinc-500">Get started in under 5 minutes</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                <Code size={20} className="text-violet-400 mb-2" />
                <h3 className="font-medium mb-1">Multi-Language</h3>
                <p className="text-xs text-zinc-500">Python, Node.js, Go, Ruby, PHP & more</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                <Globe size={20} className="text-blue-400 mb-2" />
                <h3 className="font-medium mb-1">REST API</h3>
                <p className="text-xs text-zinc-500">Standard HTTP endpoints</p>
              </div>
            </div>
          </section>

          {/* Authentication */}
          <section id="auth" className="mb-16">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Key size={20} className="text-emerald-400" /> Authentication
            </h2>
            <p className="text-zinc-400 mb-4">
              All API requests require authentication using an API key. Include your API key in the
              <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-300 mx-1">Authorization</code> header.
            </p>
            <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 mb-4">
              <p className="text-sm text-zinc-300 font-mono">Authorization: Bearer yubi-your-api-key-here</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
              <strong>Important:</strong> Keep your API key secure. Do not share it in public repositories or client-side code.
            </div>
          </section>

          {/* API Reference */}
          <section id="api-reference" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">API Reference</h2>

            <div className="p-6 rounded-xl bg-zinc-800 border border-zinc-700 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-xs font-bold">POST</span>
                <code className="text-sm text-zinc-300">/api/v1/chat</code>
              </div>
              <p className="text-sm text-zinc-400 mb-4">Send a message to YubiAI and receive an AI-generated response.</p>

              <h4 className="text-sm font-medium text-zinc-300 mb-2">Request Body</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="text-left py-2 text-zinc-400 font-medium">Parameter</th>
                      <th className="text-left py-2 text-zinc-400 font-medium">Type</th>
                      <th className="text-left py-2 text-zinc-400 font-medium">Required</th>
                      <th className="text-left py-2 text-zinc-400 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    <tr className="border-b border-zinc-700/50">
                      <td className="py-2 font-mono text-emerald-300">message</td>
                      <td className="py-2">string</td>
                      <td className="py-2">Yes</td>
                      <td className="py-2">The user message to send</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono text-emerald-300">conversation_history</td>
                      <td className="py-2">array</td>
                      <td className="py-2">No</td>
                      <td className="py-2">Previous messages for context</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4 className="text-sm font-medium text-zinc-300 mt-4 mb-2">Response</h4>
              <CodeBlock language="json" code={`{
  "response": "Hello! I'm Yubi, the AI assistant by Devopods...",
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 42,
    "total_tokens": 67
  }
}`} />
            </div>
          </section>

          {/* Python */}
          <section id="python" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">Python</h2>
            <p className="text-zinc-400 mb-4">Use the YubiAI API with Python using the <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-300">requests</code> library. Get your API key at <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>.</p>

            <h3 className="text-lg font-semibold mb-2">Installation</h3>
            <CodeBlock language="bash" code="pip install requests" />

            <h3 className="text-lg font-semibold mb-2 mt-6">Basic Usage</h3>
            <CodeBlock language="python" code={`import requests

# YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
API_URL = "${API_BASE_URL}"
API_KEY = "yubi-your-api-key-here"  # Get yours at ${APP_URL}/api-keys

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Simple chat
response = requests.post(
    f"{API_URL}/api/v1/chat",
    headers=headers,
    json={"message": "What is machine learning?"}
)

data = response.json()
print(data["response"])`} />

            <h3 className="text-lg font-semibold mb-2 mt-6">With Conversation History</h3>
            <CodeBlock language="python" code={`import requests

# YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
API_URL = "${API_BASE_URL}"
API_KEY = "yubi-your-api-key-here"  # Get yours at ${APP_URL}/api-keys
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

conversation = []

def chat(message):
    conversation.append({"role": "user", "content": message})

    response = requests.post(
        f"{API_URL}/api/v1/chat",
        headers=headers,
        json={
            "message": message,
            "conversation_history": conversation
        }
    )

    data = response.json()
    ai_response = data["response"]
    conversation.append({"role": "assistant", "content": ai_response})
    return ai_response

# Multi-turn conversation
print(chat("Hello!"))
print(chat("Tell me about Devopods"))
print(chat("What services do you offer?"))`} />
          </section>

          {/* Node.js */}
          <section id="nodejs" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">Node.js</h2>
            <p className="text-zinc-400 mb-4">Use the YubiAI API with Node.js using <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-300">axios</code>. Get your API key at <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>.</p>

            <h3 className="text-lg font-semibold mb-2">Installation</h3>
            <CodeBlock language="bash" code="npm install axios" />

            <h3 className="text-lg font-semibold mb-2 mt-6">Basic Usage</h3>
            <CodeBlock language="javascript" code={`const axios = require('axios');

// YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
const API_URL = '${API_BASE_URL}';
const API_KEY = 'yubi-your-api-key-here'; // Get yours at ${APP_URL}/api-keys

async function chat(message) {
  const response = await axios.post(
    \`\${API_URL}/api/v1/chat\`,
    { message },
    {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.response;
}

// Usage
async function main() {
  const reply = await chat('Hello, Yubi!');
  console.log(reply);
}

main();`} />

            <h3 className="text-lg font-semibold mb-2 mt-6">Express.js Integration</h3>
            <CodeBlock language="javascript" code={`const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
const API_URL = '${API_BASE_URL}';
const API_KEY = 'yubi-your-api-key-here'; // Get yours at ${APP_URL}/api-keys

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await axios.post(
      \`\${API_URL}/api/v1/chat\`,
      { message },
      { headers: { 'Authorization': \`Bearer \${API_KEY}\` } }
    );
    res.json({ reply: response.data.response });
  } catch (error) {
    res.status(500).json({ error: 'AI request failed' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));`} />
          </section>

          {/* JavaScript */}
          <section id="javascript" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">JavaScript (Browser)</h2>
            <p className="text-zinc-400 mb-4">Use the YubiAI API directly in the browser with the Fetch API. Get your API key at <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>.</p>

            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm mb-4">
              <strong>Warning:</strong> Never expose your API key in client-side code. Use a backend proxy instead.
            </div>

            <h3 className="text-lg font-semibold mb-2">Fetch API</h3>
            <CodeBlock language="javascript" code={`// YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
// Use this through a backend proxy to protect your API key

async function askYubi(message) {
  const response = await fetch('${API_BASE_URL}/api/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer yubi-your-api-key-here' // Get at ${APP_URL}/api-keys
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const data = await response.json();
  return data.response;
}

// Usage
askYubi('Explain React hooks')
  .then(reply => console.log(reply))
  .catch(err => console.error(err));`} />

            <h3 className="text-lg font-semibold mb-2 mt-6">React Integration</h3>
            <CodeBlock language="jsx" code={`import { useState } from 'react';

// YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
const API_URL = '${API_BASE_URL}';
const API_KEY = 'yubi-your-api-key-here'; // Get at ${APP_URL}/api-keys

function YubiChat() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await fetch(\`\${API_URL}/api/v1/chat\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${API_KEY}\`
        },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      setResponse(data.response);
    } catch (err) {
      setResponse('Error: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <input value={message} onChange={e => setMessage(e.target.value)} />
      <button onClick={handleSend} disabled={loading}>
        {loading ? 'Thinking...' : 'Ask Yubi'}
      </button>
      {response && <p>{response}</p>}
    </div>
  );
}`} />
          </section>

          {/* TypeScript */}
          <section id="typescript" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">TypeScript</h2>
            <p className="text-zinc-400 mb-4">Type-safe YubiAI API integration with TypeScript. Get your API key at <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>.</p>

            <h3 className="text-lg font-semibold mb-2">Installation</h3>
            <CodeBlock language="bash" code="npm install axios" />

            <h3 className="text-lg font-semibold mb-2 mt-6">Type Definitions & Usage</h3>
            <CodeBlock language="typescript" code={`import axios from 'axios';

// YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
const API_URL = '${API_BASE_URL}';
const API_KEY = 'yubi-your-api-key-here'; // Get yours at ${APP_URL}/api-keys

interface YubiResponse {
  response: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function chat(
  message: string,
  history: ChatMessage[] = []
): Promise<YubiResponse> {
  const { data } = await axios.post<YubiResponse>(
    \`\${API_URL}/api/v1/chat\`,
    { message, conversation_history: history },
    {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      }
    }
  );
  return data;
}

// Usage
async function main(): Promise<void> {
  const result = await chat('Explain TypeScript generics');
  console.log(result.response);
  console.log(\`Tokens used: \${result.usage.total_tokens}\`);
}

main();`} />
          </section>

          {/* Go */}
          <section id="go" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">Go</h2>
            <p className="text-zinc-400 mb-4">Use the YubiAI API with Go's standard <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-300">net/http</code> package. Get your API key at <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>.</p>

            <h3 className="text-lg font-semibold mb-2">Basic Usage</h3>
            <CodeBlock language="go" code={`package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

// YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
const apiURL = "${API_BASE_URL}/api/v1/chat"
const apiKey = "yubi-your-api-key-here" // Get yours at ${APP_URL}/api-keys

type ChatRequest struct {
    Message string \`json:"message"\`
}

type ChatResponse struct {
    Response string \`json:"response"\`
    Usage    struct {
        PromptTokens     int \`json:"prompt_tokens"\`
        CompletionTokens int \`json:"completion_tokens"\`
        TotalTokens      int \`json:"total_tokens"\`
    } \`json:"usage"\`
}

func askYubi(message string) (string, error) {
    body, _ := json.Marshal(ChatRequest{Message: message})
    req, _ := http.NewRequest("POST", apiURL, bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+apiKey)

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    data, _ := io.ReadAll(resp.Body)
    var result ChatResponse
    json.Unmarshal(data, &result)
    return result.Response, nil
}

func main() {
    reply, err := askYubi("What is Go?")
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println(reply)
}`} />
          </section>

          {/* Ruby */}
          <section id="ruby" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">Ruby</h2>
            <p className="text-zinc-400 mb-4">Use the YubiAI API with Ruby's <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-300">net/http</code> or the <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-300">httparty</code> gem. Get your API key at <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>.</p>

            <h3 className="text-lg font-semibold mb-2">Installation</h3>
            <CodeBlock language="bash" code="gem install httparty" />

            <h3 className="text-lg font-semibold mb-2 mt-6">Basic Usage</h3>
            <CodeBlock language="ruby" code={`require 'httparty'
require 'json'

# YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
API_URL = '${API_BASE_URL}'
API_KEY = 'yubi-your-api-key-here' # Get yours at ${APP_URL}/api-keys

def ask_yubi(message)
  response = HTTParty.post(
    "#{API_URL}/api/v1/chat",
    headers: {
      'Authorization' => "Bearer #{API_KEY}",
      'Content-Type' => 'application/json'
    },
    body: { message: message }.to_json
  )
  JSON.parse(response.body)['response']
end

# Usage
puts ask_yubi('What is Ruby on Rails?')
puts ask_yubi('How do I create a REST API in Rails?')`} />
          </section>

          {/* PHP */}
          <section id="php" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">PHP</h2>
            <p className="text-zinc-400 mb-4">Use the YubiAI API with PHP's <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-300">cURL</code> or <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-300">Guzzle</code>. Get your API key at <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>.</p>

            <h3 className="text-lg font-semibold mb-2">Using cURL</h3>
            <CodeBlock language="php" code={`<?php
// YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
$apiUrl = '${API_BASE_URL}/api/v1/chat';
$apiKey = 'yubi-your-api-key-here'; // Get yours at ${APP_URL}/api-keys

function askYubi(string $message): string {
    global $apiUrl, $apiKey;

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ],
        CURLOPT_POSTFIELDS => json_encode(['message' => $message])
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['response'];
}

// Usage
echo askYubi('What is PHP?');
echo askYubi('How do I use Laravel?');
?>`} />

            <h3 className="text-lg font-semibold mb-2 mt-6">Using Guzzle</h3>
            <CodeBlock language="php" code={`<?php
require 'vendor/autoload.php';

use GuzzleHttp\\Client;

// YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
$client = new Client([
    'base_uri' => '${API_BASE_URL}',
    'headers' => [
        'Authorization' => 'Bearer yubi-your-api-key-here', // Get at ${APP_URL}/api-keys
        'Content-Type' => 'application/json'
    ]
]);

$response = $client->post('/api/v1/chat', [
    'json' => ['message' => 'Hello from PHP!']
]);

$data = json_decode($response->getBody(), true);
echo $data['response'];
?>`} />
          </section>

          {/* cURL */}
          <section id="curl" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">cURL</h2>
            <p className="text-zinc-400 mb-4">Use the YubiAI API directly from the command line with cURL. Get your API key at <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>.</p>

            <h3 className="text-lg font-semibold mb-2">Basic Request</h3>
            <CodeBlock language="bash" code={`# YubiAI API - https://yubiai-chatbot-ss3lx2pw.devinapps.com
# Get your API key at ${APP_URL}/api-keys

curl -X POST ${API_BASE_URL}/api/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer yubi-your-api-key-here" \\
  -d '{"message": "Hello, Yubi!"}'`} />

            <h3 className="text-lg font-semibold mb-2 mt-6">With Conversation History</h3>
            <CodeBlock language="bash" code={`curl -X POST ${API_BASE_URL}/api/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer yubi-your-api-key-here" \\
  -d '{
    "message": "Tell me more",
    "conversation_history": [
      {"role": "user", "content": "What is AI?"},
      {"role": "assistant", "content": "AI is artificial intelligence..."}
    ]
  }'`} />

            <h3 className="text-lg font-semibold mb-2 mt-6">Pretty Print Response</h3>
            <CodeBlock language="bash" code={`curl -s -X POST ${API_BASE_URL}/api/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer yubi-your-api-key-here" \\
  -d '{"message": "What is DevOps?"}' | python3 -m json.tool`} />
          </section>

          {/* Errors */}
          <section id="errors" className="mb-16">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm mb-6">
              <strong>Base URL:</strong> <code className="bg-zinc-800 px-1.5 py-0.5 rounded">{API_BASE_URL}</code> | <strong>App:</strong> <a href={APP_URL} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}</a> | <strong>Get API Key:</strong> <a href={`${APP_URL}/api-keys`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">{APP_URL}/api-keys</a>
            </div>
            <h2 className="text-2xl font-bold mb-4">Error Handling</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-3 text-zinc-400 font-medium">Status Code</th>
                    <th className="text-left py-3 text-zinc-400 font-medium">Meaning</th>
                    <th className="text-left py-3 text-zinc-400 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  <tr className="border-b border-zinc-700/50">
                    <td className="py-3 font-mono text-emerald-300">200</td>
                    <td className="py-3">Success</td>
                    <td className="py-3">Request completed successfully</td>
                  </tr>
                  <tr className="border-b border-zinc-700/50">
                    <td className="py-3 font-mono text-amber-300">401</td>
                    <td className="py-3">Unauthorized</td>
                    <td className="py-3">Invalid or missing API key</td>
                  </tr>
                  <tr className="border-b border-zinc-700/50">
                    <td className="py-3 font-mono text-amber-300">422</td>
                    <td className="py-3">Validation Error</td>
                    <td className="py-3">Invalid request body</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-mono text-red-300">500</td>
                    <td className="py-3">Server Error</td>
                    <td className="py-3">Internal server error</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Rate Limits */}
          <section id="rate-limits" className="mb-16">
            <h2 className="text-2xl font-bold mb-4">Rate Limits</h2>
            <p className="text-zinc-400 mb-4">
              API rate limits are applied per API key to ensure fair usage.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-3 text-zinc-400 font-medium">Plan</th>
                    <th className="text-left py-3 text-zinc-400 font-medium">Requests/min</th>
                    <th className="text-left py-3 text-zinc-400 font-medium">Tokens/day</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  <tr className="border-b border-zinc-700/50">
                    <td className="py-3">Free</td>
                    <td className="py-3">20</td>
                    <td className="py-3">50,000</td>
                  </tr>
                  <tr className="border-b border-zinc-700/50">
                    <td className="py-3">Pro</td>
                    <td className="py-3">60</td>
                    <td className="py-3">500,000</td>
                  </tr>
                  <tr>
                    <td className="py-3">Enterprise</td>
                    <td className="py-3">Unlimited</td>
                    <td className="py-3">Custom</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
