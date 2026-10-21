document.addEventListener('DOMContentLoaded', () => {
    const essayText = document.getElementById('essay-text');
    const wordCountSpan = document.getElementById('word-count');
    const charCountSpan = document.getElementById('char-count');
    
    const analyzeBtn = document.getElementById('analyze-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    const inputSection = document.getElementById('input-section');
    const loadingSection = document.getElementById('loading-section');
    const resultSection = document.getElementById('result-section');

    // Live counting
    essayText.addEventListener('input', () => {
        const text = essayText.value;
        const charCount = text.length;
        const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        
        charCountSpan.textContent = `Таңба саны: ${charCount}`;
        wordCountSpan.textContent = `Сөз саны: ${wordCount}`;
    });

    // Start Analysis (Mock)
    analyzeBtn.addEventListener('click', () => {
        const topic = document.getElementById('essay-topic').value;
        const text = essayText.value;

        if(!topic.trim() || !text.trim()) {
            alert('Өтініш, тақырып пен эссе мәтінін толтырыңыз.');
            return;
        }

        // Show loading
        inputSection.classList.remove('active-section');
        inputSection.classList.add('hidden-section');
        
        loadingSection.classList.remove('hidden-section');
        loadingSection.classList.add('active-section');

        // Mock delay for "analysis"
        setTimeout(() => {
            analyzeEssayFull(topic, text);
            
            loadingSection.classList.remove('active-section');
            loadingSection.classList.add('hidden-section');
            
            resultSection.classList.remove('hidden-section');
            resultSection.classList.add('active-section');
        }, 2000);
    });

    // Reset Form
    resetBtn.addEventListener('click', () => {
        resultSection.classList.remove('active-section');
        resultSection.classList.add('hidden-section');
        
        inputSection.classList.remove('hidden-section');
        inputSection.classList.add('active-section');
        
        document.getElementById('essay-topic').value = '';
        essayText.value = '';
        essayText.dispatchEvent(new Event('input')); // reset counters
    });

    function analyzeEssayFull(topic, originalText) {
        // Regex patterns for markers
        const thesisRegex = /(менің ойымша|меніңше|деп білемін|сенімдімін|көзім жетті)/gi;
        const argRegex = /(біріншіден|екіншіден|сонымен қатар|себебі|өйткені|ең алдымен|қорыта айтқанда|қорытындылай келе|яғни|дегенмен)/gi;
        const evRegex = /(мысалы|атап айтқанда|деген болатын|айтқан сөзі|статистика бойынша|дәлел ретінде|зерттеулерге)/gi;

        // 1. Text basic stats
        const wordsArray = originalText.trim().split(/\s+/);
        const wordsCount = wordsArray.length;
        
        // Remove punctuation and lowercase
        const cleanText = originalText.toLowerCase().replace(/[.,!?"'«»()\-:]/g, ' ');
        const cleanWords = cleanText.split(/\s+/).filter(w => w.length > 2);

        // 2. VERY STRICT Gibberish Check
        const commonKazakhWords = ['және', 'мен', 'пен', 'бен', 'үшін', 'ол', 'бұл', 'сол', 'деп', 'бар', 'жоқ', 'бір', 'болады', 'емес', 'керек', 'қажет', 'бірақ', 'деген', 'бойынша', 'оның', 'олар', 'өз', 'біз', 'сіз', 'түрде', 'туралы', 'адам', 'сияқты', 'ғана', 'жақсы', 'екенін', 'арқылы', 'бойы', 'тақырып', 'мәселе', 'қазіргі', 'заман', 'білім', 'ғылым', 'еліміз', 'қоғам', 'өмір', 'көп', 'аз', 'тек', 'мүмкін', 'тиіс', 'ала', 'бере', 'ана', 'әке', 'тіл', 'ел', 'жер', 'халық'];
        
        let validWordCount = 0;
        cleanWords.forEach(w => {
            if (commonKazakhWords.includes(w)) validWordCount++;
        });

        const isGibberish = (wordsCount > 5 && validWordCount === 0) || (cleanWords.some(w => w.length > 25));
        const isTooShort = wordsCount < 30;

        let structureScore = 0, argScore = 0, logicScore = 0, evScore = 0, langScore = 0;
        let strengths = [], weaknesses = [], recommendations = [];

        const topicWords = topic.toLowerCase().replace(/[.,!?"'«»()\-:]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        
        let topicFound = false;
        if (topicWords.length === 0) topicFound = true; 

        topicWords.forEach(tw => {
            const root = tw.substring(0, Math.max(tw.length - 2, 3)); 
            if (cleanWords.some(w => w.startsWith(root))) {
                topicFound = true;
            }
        });

        if (isGibberish) {
            weaknesses.push("Мәтін мағынасыз немесе кездейсоқ әріптерден тұрады.");
            weaknesses.push("Қазақ тілінің грамматикасы мен лексикасы сақталмаған.");
            recommendations.push("Кездейсоқ әріптерді емес, қазақ тіліндегі мағыналы, дұрыс сөйлемдерден тұратын эссе жазыңыз.");
        } else if (isTooShort) {
            langScore = 5; // Give tiny points for at least typing real words
            weaknesses.push("Эссе көлемі өте қысқа (30 сөзге жетпейді).");
            weaknesses.push("Бұл толыққанды эссе емес, жай ғана бірнеше сөйлем.");
            recommendations.push("Эссе кем дегенде 100-150 сөзден тұруы керек. Кіріспе, негізгі бөлім және қорытынды жазыңыз.");
        } else {
            // NORMAL ANALYSIS (STRICTER)
            const thesisMatches = originalText.match(thesisRegex) || [];
            const argMatches = originalText.match(argRegex) || [];
            const evMatches = originalText.match(evRegex) || [];

            // Structure
            structureScore = 5;
            if (wordsCount > 80) structureScore += 5;
            if (wordsCount > 150) structureScore += 10;
            if (argMatches.length >= 2) structureScore += 5;

            // Arg
            argScore = 0;
            if (thesisMatches.length > 0) argScore += 15;
            if (argMatches.length > 0) argScore += 5;
            if (argMatches.length >= 2) argScore += 10;

            // Logic
            logicScore = 0;
            if (argMatches.length >= 1) logicScore += 5;
            if (argMatches.length >= 3) logicScore += 10;
            if (wordsCount > 100) logicScore += 5;

            // Evidence
            evScore = 0;
            if (evMatches.length >= 1) evScore += 7;
            if (evMatches.length >= 2) evScore += 8;

            // Lang
            langScore = 4;
            if (wordsCount > 100) langScore += 3;
            if (wordsCount > 150) langScore += 3;

            // Topic Penalty
            let isOffTopic = false;
            if (topicWords.length > 0 && !topicFound) {
                isOffTopic = true;
                structureScore = 0;
                argScore = 0;
                logicScore = 0;
                evScore = 0;
                weaknesses.push(`Эссе тақырыбы ("${topic}") мәтін мазмұнына мүлде сәйкес келмейді.`);
                recommendations.push("Тақырыптан ауытқымаңыз. Мәтін тақырыпты толық ашуы керек.");
            } else if (topicWords.length > 0) {
                strengths.push("Эссе тақырыбы мәтін мазмұнымен сәйкес келеді, тақырып ашылған.");
            }

            // Normal Feedbacks
            if (!isOffTopic) {
                if (wordsCount > 120) strengths.push("Эссе көлемі мен құрылымы жақсы сақталған.");
                else weaknesses.push("Эссенің көлемін ұлғайтып, ойды кеңірек тарқату қажет.");

                if (thesisMatches.length > 0) strengths.push("Автордың негізгі позициясы (тезисі) анық берілген.");
                else {
                    weaknesses.push("Нақты тезис немесе автордың негізгі ойы байқалмайды.");
                    recommendations.push("Кіріспеде өз ойыңызды 'Менің ойымша...' деп нақтылап жазыңыз.");
                }

                if (argMatches.length >= 2) strengths.push("Аргументтер мен абзацтарды байланыстырушы сөздер дұрыс қолданылған.");
                else {
                    weaknesses.push("Абзацтарды және аргументтерді байланыстыратын құрылымдық сөздер жоқ немесе аз.");
                    recommendations.push("Абзацтарды байланыстыру үшін 'біріншіден', 'себебі' сияқты сөздерді көбірек қосыңыз.");
                }

                if (evMatches.length > 0) strengths.push("Айтылған ойды бекітетін дәлелдер немесе мысалдар келтірілген.");
                else {
                    weaknesses.push("Аргументтерді дәлелдейтін нақты мысалдар жоқ.");
                    recommendations.push("Әр аргументке өмірден немесе статистикадан мысал келтіріңіз.");
                }
            }
            
            if (recommendations.length === 0 && !isOffTopic) {
                recommendations.push("Осы қарқынмен жалғастырыңыз, эссенің логикасы өте тамаша!");
            }
        }

        // Apply bounds
        structureScore = Math.min(Math.max(structureScore, 0), 25);
        argScore = Math.min(Math.max(argScore, 0), 30);
        logicScore = Math.min(Math.max(logicScore, 0), 20);
        evScore = Math.min(Math.max(evScore, 0), 15);
        langScore = Math.min(Math.max(langScore, 0), 10);

        const criteria = [
            { name: "Құрылым", score: structureScore, max: 25 },
            { name: "Аргументация", score: argScore, max: 30 },
            { name: "Логика", score: logicScore, max: 20 },
            { name: "Дәлелдер", score: evScore, max: 15 },
            { name: "Тілдік сапа", score: langScore, max: 10 }
        ];

        const totalScore = criteria.reduce((acc, curr) => acc + curr.score, 0);
        document.getElementById('total-score-value').textContent = totalScore;

        const tbody = document.getElementById('criteria-body');
        tbody.innerHTML = '';
        criteria.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.name}</td>
                <td>${c.score}</td>
                <td>${c.max}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('strengths-list').innerHTML = strengths.length ? strengths.map(s => `<li>${s}</li>`).join('') : '<li>-</li>';
        document.getElementById('weaknesses-list').innerHTML = weaknesses.length ? weaknesses.map(w => `<li>${w}</li>`).join('') : '<li>-</li>';
        document.getElementById('recommendations-list').innerHTML = recommendations.length ? recommendations.map(r => `<li>${r}</li>`).join('') : '<li>-</li>';

        // Visual annotation WITH TOPIC
        let annotatedHtml = `<div style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);"><strong>Тақырып:</strong> ${topic}</div>`;
        annotatedHtml += originalText
            .replace(/\n/g, '<br><br>')
            .replace(thesisRegex, '<mark class="mark-thesis" title="Тезис маркері">$1</mark>')
            .replace(argRegex, '<mark class="mark-argument" title="Аргумент/Құрылым маркері">$1</mark>')
            .replace(evRegex, '<mark class="mark-evidence" title="Дәлел маркері">$1</mark>');
        
        document.getElementById('annotated-text').innerHTML = annotatedHtml;

        // Save result to local storage for history
        const historyItem = {
            date: new Date().toLocaleString(),
            topic,
            score: totalScore,
            text: originalText
        };
        const existing = JSON.parse(localStorage.getItem('essayHistory') || '[]');
        existing.unshift(historyItem);
        localStorage.setItem('essayHistory', JSON.stringify(existing));

        // PDF export
        document.getElementById('download-pdf').addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFont('Helvetica');
            doc.text('Эссе бағалау нәтижелері', 10, 10);
            doc.text(`Тақырып: ${topic}`, 10, 20);
            doc.text(`Жалпы балл: ${totalScore}/100`, 10, 30);
            let y = 40;
            criteria.forEach(c => {
                doc.text(`${c.name}: ${c.score}/${c.max}`, 10, y);
                y += 10;
            });
            y += 5;
            doc.text('Күшті жақтары:', 10, y);
            y += 10;
            strengths.forEach(s => { doc.text(`- ${s}`, 12, y); y += 7; });
            y += 5;
            doc.text('Әлсіз жақтары:', 10, y);
            y += 10;
            weaknesses.forEach(w => { doc.text(`- ${w}`, 12, y); y += 7; });
            y += 5;
            doc.text('Ұсыныстар:', 10, y);
            y += 10;
            recommendations.forEach(r => { doc.text(`- ${r}`, 12, y); y += 7; });
            doc.save('essay_evaluation.pdf');
        });

        // History view handling
        function renderHistory() {
            const list = document.getElementById('history-list');
            list.innerHTML = '';
            const history = JSON.parse(localStorage.getItem('essayHistory') || '[]');
            history.forEach((item) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${item.date}</strong> – ${item.topic} – ${item.score}/100`;
                li.style.cursor = 'pointer';
                li.addEventListener('click', () => {
                    alert(item.text);
                });
                list.appendChild(li);
            });
        }

        document.getElementById('view-history').addEventListener('click', () => {
            document.getElementById('result-section').classList.remove('active-section');
            document.getElementById('result-section').classList.add('hidden-section');
            document.getElementById('history-section').classList.remove('hidden-section');
            document.getElementById('history-section').classList.add('active-section');
            renderHistory();
        });

        document.getElementById('back-to-input').addEventListener('click', () => {
            document.getElementById('history-section').classList.remove('active-section');
            document.getElementById('history-section').classList.add('hidden-section');
            document.getElementById('input-section').classList.remove('hidden-section');
            document.getElementById('input-section').classList.add('active-section');
        });
        // Navigation handling functions
        const hideAll = () => {
            ['input-section', 'loading-section', 'result-section', 'history-section', 'about-section'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.remove('active-section');
                    el.classList.add('hidden-section');
                }
            });
        };
        const showSection = (id) => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('hidden-section');
                el.classList.add('active-section');
            }
        };
        // Navbar clicks
        document.getElementById('nav-home').addEventListener('click', (e) => {
            e.preventDefault();
            hideAll();
            showSection('input-section');
        });
        document.getElementById('nav-history').addEventListener('click', (e) => {
            e.preventDefault();
            hideAll();
            showSection('history-section');
            renderHistory();
        });
        document.getElementById('nav-about').addEventListener('click', (e) => {
            e.preventDefault();
            hideAll();
            showSection('about-section');
        });
        // Back From About button
        document.getElementById('back-from-about').addEventListener('click', () => {
            hideAll();
            showSection('input-section');
        });
    }
});
