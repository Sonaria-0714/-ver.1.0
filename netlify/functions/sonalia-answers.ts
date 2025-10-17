import OpenAI from "openai";
import Ajv from "ajv";
import fs from "fs";
import path from "path";
const R = (...p: string[]) => path.join(process.cwd(), ...p);

// JSON/MDはfsで読む（Netlifyで確実に通る）
const weights = JSON.parse(fs.readFileSync(R("packages","weights","weights_v1.json"),"utf8"));
const schema  = JSON.parse(fs.readFileSync(R("packages","schemas","report.schema.json"),"utf8"));
const system  = fs.readFileSync(R("packages","prompts","system.md"),"utf8");

// スコア関数
import { scoreAnswers } from "../../packages/scoring/score";

const ajv = new Ajv({ allErrors: true, removeAdditional: true });
const validate = ajv.compile(schema as any);

export const handler = async (event:any) => {
  try {
    const { userId, roots, answers36, rtMs } = JSON.parse(event.body||"{}");
    if (!Array.isArray(answers36) || answers36.length !== 36) {
      return j(400,{ error: "answers36 must be length 36" });
    }

    const scoring = scoreAnswers({ answers36, rtMs }, weights);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const resp = await client.responses.create({
      model: "gpt-5",
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ roots, scoring }) }
      ]
    });

    let text = (resp as any).output_text || "";
    let data:any; try { data = JSON.parse(text); } catch { data = fallback(scoring); }
    if (!validate(data)) data = fallback(scoring);
    data.meta = { scoring_version: scoring.meta.scoring_version, model: "gpt-5" };

    return j(200, { sessionId: crypto.randomUUID(), report: data, scores: scoring });
  } catch(e:any) {
    return j(500, { error: e?.message || "server error" });
  }
};

const j=(s:number,b:any)=>({statusCode:s,headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});

function fallback(s:any){
  return {
    you_are:"直感と判断のバランスが鍵。即行と比較の配分で成果が変わるタイプ。",
    roots_summary:"育ちや経験から、対人場面の空気をつかむ力が強い。",
    wp_code: s.fcea.E > 70 ? "E過滞留／比較で足が止まる" : "A低速／実行が後回し",
    ss_name:"空気OS設計士：C×KQ",
    next_you:["60秒で行動を一つ決める","相手の期待を1行で定義","5分試作→評価は後"],
    future_path:["会議は要点先出し","初対面は目的を最初の1分で","迷ったら比較停止→小タスク開始"],
    role_fit:{fit:"副キャプテン／調整役／ムードメーカー",avoid:"決裁が遅れる単独リーダー"},
    meta:{}
  };
}
