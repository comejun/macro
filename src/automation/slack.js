/**
 * Slack Incoming Webhook 전송 유틸.
 */
const https = require("https");

function fillTemplate(template, values) {
  return String(template ?? "").replace(
    /\{(requestNumber|quotePageUrl|brandModelLine|appliedQuotePriceBasis)\}/g,
    (_, key) => String(values?.[key] ?? ""),
  );
}

/**
 * @param {{
 *  webhookUrl: string;
 *  text: string;
 *  timeoutMs?: number;
 * }} args
 */
async function postSlackWebhook({ webhookUrl, text, timeoutMs = 10_000 }) {
  const url = String(webhookUrl ?? "").trim();
  if (!url) throw new Error("Slack webhook URL이 비어 있습니다.");
  const body = JSON.stringify({ text: String(text ?? "") });

  await new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
            return;
          }
          reject(
            new Error(
              `Slack webhook 응답 오류 (status=${res.statusCode ?? "unknown"}, body=${data.trim()})`,
            ),
          );
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Slack webhook 전송 타임아웃")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  postSlackWebhook,
  fillTemplate,
};
