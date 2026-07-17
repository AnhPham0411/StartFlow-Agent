#!/usr/bin/env node
/*
 * Ghi lại mỗi lượt chat với Claude Code (câu vào / câu ra / thời gian / model / token)
 * ra file ai.log ở gốc project — làm minh chứng có sử dụng AI.
 *
 * Chạy như một Stop hook: Claude Code truyền JSON qua stdin, trong đó có
 * transcript_path trỏ tới file hội thoại của phiên hiện tại.
 */
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const LOG_FILE = path.join(PROJECT_ROOT, "ai.log");
const STATE_FILE = path.join(__dirname, ".last_logged_uuid");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

// Gộp các block dạng text trong message.content thành một chuỗi
function textOf(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
  return "";
}

// Bóc các thẻ hệ thống mà IDE/Claude Code chèn vào câu người dùng
// (ide_opened_file, ide_selection, system-reminder, local-command...) để
// còn lại đúng câu người dùng gõ.
function cleanUserText(text) {
  return text
    .replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, "")
    .replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-[\s\S]*?<\/local-command-[a-z]+>/g, "")
    .replace(/<command-[a-z]+>[\s\S]*?<\/command-[a-z]+>/g, "")
    .trim();
}

// Chỉ tính là "câu người dùng gõ thật" khi message có origin.kind === "human"
function isHumanPrompt(obj) {
  return !!(obj.origin && obj.origin.kind === "human");
}

function main() {
  let hook = {};
  try {
    hook = JSON.parse(readStdin() || "{}");
  } catch {
    return;
  }

  const transcript = hook.transcript_path;
  if (!transcript || !fs.existsSync(transcript)) return;

  const lines = fs.readFileSync(transcript, "utf-8").split(/\r?\n/);

  let lastUser = null; // câu hỏi người dùng gần nhất (bỏ qua tool_result)
  let lastAssistant = null; // câu trả lời AI gần nhất có nội dung text

  for (const ln of lines) {
    if (!ln.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(ln);
    } catch {
      continue;
    }
    const msg = obj.message || {};
    if (obj.type === "user") {
      // chỉ lấy câu người dùng gõ thật (origin human) và có nội dung sau khi làm sạch
      if (isHumanPrompt(obj) && cleanUserText(textOf(msg.content))) lastUser = obj;
    } else if (obj.type === "assistant") {
      if (textOf(msg.content)) lastAssistant = obj;
    }
  }

  if (!lastAssistant) return;

  // Chống ghi trùng: mỗi câu trả lời (uuid) chỉ log một lần
  const uuid = lastAssistant.uuid || "";
  try {
    if (fs.existsSync(STATE_FILE) && fs.readFileSync(STATE_FILE, "utf-8").trim() === uuid) return;
  } catch {}

  const aMsg = lastAssistant.message || {};
  const usage = aMsg.usage || {};
  const record = {
    time: new Date().toISOString(),
    session_id: lastAssistant.sessionId || "",
    model: aMsg.model || "",
    input_tokens: usage.input_tokens ?? null,
    output_tokens: usage.output_tokens ?? null,
    user: cleanUserText(textOf((lastUser && lastUser.message && lastUser.message.content) || "")),
    assistant: textOf(aMsg.content),
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n", "utf-8");
  try {
    fs.writeFileSync(STATE_FILE, uuid, "utf-8");
  } catch {}
}

main();
