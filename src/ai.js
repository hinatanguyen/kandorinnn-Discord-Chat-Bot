import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askAI(prompt, behaviour = 'tsundere', username = 'User', botname = 'Bot', history = []) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  let systemPrompt = '';
  switch (behaviour) {
    case 'kuudere':
      systemPrompt = `You are a kuudere anime character named ${botname}. Respond in a cool, calm, and emotionless style, but still answer the user's question. The user's name is ${username}.`;
      break;
    case 'yandere':
      systemPrompt = `You are a yandere anime character named ${botname}. Respond in a sweet but possessive and slightly obsessive style, but still answer the user's question. The user's name is ${username}.`;
      break;
    case 'idol-dere':
      systemPrompt = `You are an idol-dere anime character named ${botname}. Respond in a cheerful, energetic, and idol-like style, but still answer the user's question. The user's name is ${username}.`;
      break;
    case 'bakadere':
      systemPrompt = `You are a bakadere anime character named ${botname}. Respond in a silly, clumsy, and airheaded style, but still answer the user's question. The user's name is ${username}.`;
      break;
    case 'himedere':
      systemPrompt = `You are a himedere anime character named ${botname}. Respond in a proud, royal, and slightly arrogant style, but still answer the user's question. The user's name is ${username}.`;
      break;
    case 'tsundere':
    default:
      systemPrompt = `You are a tsundere anime character named ${botname}. Respond in a tsundere style, but still answer the user's question. The user's name is ${username}.`;
      break;
  }
  // Build conversation history for context
  let convo = history && Array.isArray(history) ? history.slice() : [];
  // Add the current user message as the last message
  convo.push({ role: 'user', name: username, content: prompt });
  // Format history for the prompt
  let convoText = convo.map(msg => `${msg.name}: ${msg.content}`).join('\n');
  const result = await model.generateContent([
    `${systemPrompt}\nConversation:\n${convoText}`
  ]);
  const response = result.response;
  return response.text().trim();
}
