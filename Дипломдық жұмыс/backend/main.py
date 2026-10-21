from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import re

app = FastAPI()

# Allow CORS for local development (optional)
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    topic: str
    text: str

@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    original_text = req.text
    topic = req.topic

    # -------------------- 1. Basic stats --------------------
    words = [w for w in re.split(r"\s+", original_text.strip()) if w]
    words_count = len(words)

    # Clean text for lexical checks
    clean_text = re.sub(r"[.,!?\"'«»()\-:]", " ", original_text.lower())
    clean_words = [w for w in clean_text.split() if len(w) > 2]

    # -------------------- 2. Gibberish detection --------------------
    common_kz_words = [
        "және", "мен", "пен", "бен", "үшін", "ол", "бұл", "сол", "деп", "бар", "жоқ",
        "бір", "болады", "емес", "керек", "қажет", "бірақ", "деген", "бойынша", "оның",
        "олар", "өз", "біз", "сіз", "түрде", "туралы", "адам", "сияқты", "ғана", "жақсы",
        "екенін", "арқылы", "бойы", "тақырып", "мәселе", "қазіргі", "заман", "білім",
        "ғылым", "еліміз", "қоғам", "өмір", "көп", "аз", "тек", "мүмкін", "тиіс", "ала",
        "бере", "ана", "әке", "тіл", "ел", "жер", "халық",
    ]
    valid_word_cnt = sum(1 for w in clean_words if w in common_kz_words)
    is_gibberish = (words_count > 5 and valid_word_cnt == 0) or any(len(w) > 25 for w in clean_words)
    is_too_short = words_count < 30

    # -------------------- 3. Topic relevance --------------------
    topic_words = [w for w in re.sub(r"[.,!?\"'«»()\-:]", " ", topic.lower()).split() if len(w) > 2]
    topic_found = not topic_words  # true if there are no meaningful words
    if topic_words:
        for tw in topic_words:
            root = tw[: max(len(tw) - 2, 3)]
            if any(w.startswith(root) for w in clean_words):
                topic_found = True
                break

    # -------------------- 4. Marker regexes (extended) --------------------
    # Тезис маркерлері (көптеген сөз тіркестері)
    thesis_markers = [
        r"менің ойымша",
        r"менің пікірімше",
        r"менің көзқарасым бойынша",
        r"меніңше",
        r"сондықтан",
        r"сол себепті",
        r"демек",
        r"осыған байланысты",
        r"ен бастысы",
        r"қорытындылай келе",
        r"\bменіңше,? .+ қажет",
        r"маңызды деп есептеймін",
    ]
    thesis_pat = re.compile(r"(?:" + "|".join(thesis_markers) + r")", re.IGNORECASE)

    # Аргумент маркерлері (негіздеу, себеп)
    arg_markers = [
        r"біріншіден",
        r"екіншіден",
        r"сонымен қатар",
        r"себебі",
        r"өйткені",
        r"ең алдымен",
        r"қорыта айтқанда",
        r"яғни",
        r"дегенмен",
        r"алдын ала",
        r"нәтижесінде",
        r"алмай",
        r"бірақ",
        r"осыған байланысты",
        r"сонымен",
        r"сондықтан",
    ]
    arg_pat = re.compile(r"(?:" + "|".join(arg_markers) + r")", re.IGNORECASE)

    # Дәлел маркерлері (мысал, статистика, факт)
    evidence_markers = [
        r"мысалы",
        r"мәселен",
        r"айталық",
        r"айтыңдар",
        r"деген болатын",
        r"айтқан сөзі",
        r"статистика бойынша",
        r"дәлел ретінде",
        r"зерттеулерге",
        r"факт",
        r"шамамен",
        r" пайыз",
        r"\d+%",
        r"\d+\s?келген",
        r"\d+\s?рет",
    ]
    ev_pat = re.compile(r"(?:" + "|".join(evidence_markers) + r")", re.IGNORECASE)

    # -------------------- 5. Scoring (strict) --------------------
    structure = 0
    argument = 0
    logic = 0
    evidence = 0
    language = 0
    strengths: List[str] = []
    weaknesses: List[str] = []
    recommendations: List[str] = []

    if is_gibberish:
        weaknesses.append("Мәтін мағынасыз немесе кездейсоқ әріптерден тұрады.")
        weaknesses.append("Қазақ тілінің грамматикасы мен лексикасы сақталмаған.")
        recommendations.append("Кездейсоқ әріптерді емес, қазақ тіліндегі мағыналы, дұрыс сөйлемдерден тұратын эссе жазыңыз.")
    elif is_too_short:
        language = 5
        weaknesses.append("Эссе көлемі өте қысқа (30 сөзге жетпейді).")
        weaknesses.append("Бұл толыққанды эссе емес, жай бірнеше сөйлем.")
        recommendations.append("Эссе кем дегенде 100‑150 сөзден тұруы керек. Кіріспе, негізгі бөлім, қорытынды жазыңыз.")
    else:
        # Find matches
        thesis_matches = thesis_pat.findall(original_text)
        arg_matches = arg_pat.findall(original_text)
        ev_matches = ev_pat.findall(original_text)

        # Basic counts
        thesis_detected = bool(thesis_matches)
        argument_count = len(arg_matches)
        evidence_count = len(ev_matches)

        # Structure detection (intro, body, conclusion)
        paragraphs = [p.strip() for p in original_text.split("\n\n") if p.strip()]
        intro_detected = any(re.search(r"кіріспе|алғашында|басында", p, re.IGNORECASE) for p in paragraphs[:1])
        conclusion_detected = any(re.search(r"қорытындылай келе|сонымен|деген соң|жыйынтықа", p, re.IGNORECASE) for p in paragraphs[-1:])
        body_detected = len(paragraphs) >= 3

        # Scores
        structure = 5
        if words_count > 80:
            structure += 5
        if words_count > 150:
            structure += 10
        if intro_detected:
            structure += 5
        if body_detected:
            structure += 5
        if conclusion_detected:
            structure += 5

        argument = 0
        if thesis_detected:
            argument += 15
        if argument_count >= 1:
            argument += 5
        if argument_count >= 2:
            argument += 10

        logic = 0
        if argument_count >= 1:
            logic += 5
        if argument_count >= 3:
            logic += 10
        if words_count > 100:
            logic += 5

        evidence = 0
        if evidence_count >= 1:
            evidence += 7
        if evidence_count >= 2:
            evidence += 8

        language = 4
        if words_count > 100:
            language += 3
        if words_count > 150:
            language += 3

    # Find matches
    thesis_matches = thesis_pat.findall(original_text)
    arg_matches = arg_pat.findall(original_text)
    ev_matches = ev_pat.findall(original_text)

    # Basic counts
    thesis_detected = bool(thesis_matches)
    argument_count = len(arg_matches)
    evidence_count = len(ev_matches)

    # Structure detection (intro, body, conclusion)
    paragraphs = [p.strip() for p in original_text.split("\n\n") if p.strip()]
    intro_detected = any(re.search(r"кіріспе|алғашында|басында", p, re.IGNORECASE) for p in paragraphs[:1])
    conclusion_detected = any(re.search(r"қорытындылай келе|сонымен|деген соң|жыйынтықа", p, re.IGNORECASE) for p in paragraphs[-1:])
    body_detected = len(paragraphs) >= 3

    # Scores
    structure = 5
    if words_count > 80:
        structure += 5
    if words_count > 150:
        structure += 10
    if intro_detected:
        structure += 5
    if body_detected:
        structure += 5
    if conclusion_detected:
        structure += 5

    argument = 0
    if thesis_detected:
        argument += 15
    if argument_count >= 1:
        argument += 5
    if argument_count >= 2:
        argument += 10

    logic = 0
    if argument_count >= 1:
        logic += 5
    if argument_count >= 3:
        logic += 10
    if words_count > 100:
        logic += 5

    evidence = 0
    if evidence_count >= 1:
        evidence += 7
    if evidence_count >= 2:
        evidence += 8

    language = 4
    if words_count > 100:
        language += 3
    if words_count > 150:
        language += 3

    # Topic relevance penalty
    if topic_words and not topic_found:
        structure = argument = logic = evidence = 0
        weaknesses.append(f"Эссе тақырыбы (\"{topic}\") мәтін мазмұсына мүлде сәйкес келмейді.")
        recommendations.append("Тақырыптан ауытқымаңыз. Мәтін тақырыпты толық ашуы керек.")
    else:
        strengths.append("Эссе тақырыбы мәтін мазмұнымен сәйкес келеді, тақырып ашылған.")

    # Feedback
    if words_count > 120:
        strengths.append("Эссе көлемі мен құрылымы жақсы сақталған.")
    else:
        weaknesses.append("Эссенің көлемін ұлғайтып, ойды кеңірек тарқату қажет.")
    if thesis_detected:
        strengths.append("Автордың негізгі позициясы (тезисі) анық берілген.")
    else:
        weaknesses.append("Нақты тезис немесе автордың негізгі ойы байқалмайды.")
        recommendations.append("Кіріспеде өз ойыңызды 'Менің ойымша...' деп нақтылап жазыңыз.")
    if argument_count >= 2:
        strengths.append("Аргументтер мен абзацтарды байланыстырушы сөздер дұрыс қолданылған.")
    else:
        weaknesses.append("Абзацтарды және аргументтерді байланыстыратын құрылымдық сөздер аз.")
        recommendations.append("Абзацтарды байланыстыру үшін 'біріншіден', 'себебі' сияқты сөздерді қосыңыз.")
    if evidence_count >= 1:
        strengths.append("Айтылған ойды бекітетін дәлелдер немесе мысалдар келтірілген.")
    else:
        weaknesses.append("Аргументтерді дәлелдейтін нақты мысалдар жоқ.")
        recommendations.append("Әр аргументке өмірден, статистикадан немесе әдебиеттен мысал келтіріңіз.")

    if not recommendations:
        recommendations.append("Осы қарқынмен жалғастырыңыз, эссенің логикасы өте тамаша!")

    # Cap scores
    structure = min(structure, 25)
    argument = min(argument, 30)
    logic = min(logic, 20)
    evidence = min(evidence, 15)
    language = min(language, 10)
    total_score = structure + argument + logic + evidence + language

    criteria = [
        {"name": "Құрылым", "score": structure, "max": 25},
        {"name": "Аргументация", "score": argument, "max": 30},
        {"name": "Логика", "score": logic, "max": 20},
        {"name": "Дәлелдер", "score": evidence, "max": 15},
        {"name": "Тілдік сапа", "score": language, "max": 10},
    ]

    def mark_html(pattern: re.Pattern, css_class: str, title: str, txt: str) -> str:
        return pattern.sub(lambda m: f'<mark class="{css_class}" title="{title}">{m.group(0)}</mark>', txt)

    annotated = original_text.replace("\n", "<br><br>")
    annotated = mark_html(thesis_pat, "mark-thesis", "Тезис маркері", annotated)
    annotated = mark_html(arg_pat, "mark-argument", "Аргумент/Құрылым маркері", annotated)
    annotated = mark_html(ev_pat, "mark-evidence", "Дәлел маркері", annotated)
    annotated_html = f'<div style="margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid var(--border-color);"><strong>Тақырып:</strong> {topic}</div>' + annotated

    return {
    "totalScore": total_score,
    "criteria": criteria,
    "strengths": strengths,
    "weaknesses": weaknesses,
    "recommendations": recommendations,
    "annotatedHtml": annotated_html,
    "thesisDetected": thesis_detected,
    "argumentCount": argument_count,
    "evidenceCount": evidence_count,
    "introDetected": intro_detected,
    "bodyDetected": body_detected,
    "conclusionDetected": conclusion_detected,
    "logicScore": logic,
    "languageScore": language,
}

