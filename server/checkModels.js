import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models) {
      console.log("Available Models:");
      data.models.forEach((m) => {
        const methods = m.supportedMethods ? m.supportedMethods.join(', ') : 'N/A';
        console.log(`- Name: ${m.name}, Methods: ${methods}`);
      });
    } else {
      console.error("No models found or error in response:", data);
    }
  } catch (err) {
    console.error("Error fetching models:", err.message);
  }
}

listModels();
