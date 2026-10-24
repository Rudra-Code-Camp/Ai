# Ruco AI

Chat app by RudraCodes (developer: Rudra Sharma), powered by Groq.

Files:
- `index.html` the whole app (no build step)
- `api/chat.js` small server function that holds your Groq key and streams answers
- `package.json` tells the host to run `api/chat.js` as a module

## Deploy for free (about 10 minutes)

1. **Get a Groq key.** Sign up at https://console.groq.com, open API Keys, create one, copy it.
2. **Put the folder on GitHub.** Create a new repository, choose "uploading an existing file", and drag in `index.html`, `package.json`, and the `api` folder (with `chat.js` inside). Commit.
3. **Deploy on Vercel.** Sign in at https://vercel.com with GitHub, click Add New > Project, import the repository, then open Environment Variables and add:
   - Name: `GROQ_API_KEY`
   - Value: your key
   Click Deploy. You get a free `yourname.vercel.app` address.
4. **Open it and send a message.** If you see "Something went wrong", check that the variable name is exactly `GROQ_API_KEY`, then redeploy.

## Notes

- Never paste your key into `index.html`. Anyone could copy it. It belongs only in the host's environment variables.
- Answer depth maps to models in `api/chat.js`: Fast = `llama-3.1-8b-instant`, Balanced = `llama-3.3-70b-versatile`, Deep = `openai/gpt-oss-120b`. Edit the `MODELS` list there if Groq changes its model names.
- Groq's free tier has usage limits shared by all your visitors. If it fills up, people see a "busy" message. Check your limits in the Groq console.
- Vercel's free Hobby plan is meant for personal, non-commercial projects.
- Chat history is stored in each visitor's own browser.
