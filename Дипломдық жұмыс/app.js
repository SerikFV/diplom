document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const labels = {thesis: 'Тезис', argument: 'Аргумент', evidence: 'Дәлел', counterargument: 'Қарсы пікір', comparison: 'Салыстыру', conclusion: 'Қорытынды', language: 'Тіл', logic: 'Логика'};
    function show(id) {
        ['input-section', 'loading-section', 'result-section', 'history-section', 'about-section'].forEach(name => {
            $(name).classList.toggle('active-section', name === id);
            $(name).classList.toggle('hidden-section', name !== id);
        });
    }
    function list(id, items) {
        $(id).replaceChildren(...(items.length ? items : ['—']).map(text => {
            const li = document.createElement('li'); li.textContent = text; return li;
        }));
    }
    function history() {
        try {
            const entries = JSON.parse(localStorage.getItem('essayHistory') || '[]');
            return Array.isArray(entries) ? entries.filter(item => item && typeof item.text === 'string') : [];
        } catch { return []; }
    }
    function renderHistory() {
        $('history-list').replaceChildren();
        history().forEach(item => {
            const li = document.createElement('li');
            const button = document.createElement('button'); button.className = 'btn-secondary';
            button.textContent = `${item.date} — ${item.topic} — ${item.score}/100`;
            button.addEventListener('click', () => {
                if (item.result) { render(item.result, item.topic, item.text); show('result-section'); }
                else { $('essay-topic').value = item.topic; $('essay-text').value = item.text; count(); show('input-section'); }
            });
            li.append(button); $('history-list').append(li);
        });
        if (!$('history-list').children.length) list('history-list', ['Тарих әзірге бос.']);
    }
    function count() {
        const text = $('essay-text').value;
        $('word-count').textContent = `Сөз саны: ${text.trim() ? text.trim().split(/\s+/u).length : 0}`;
        $('char-count').textContent = `Таңба саны: ${text.length}`;
    }
    function highlight(text, markers) {
        const box = $('annotated-text'); box.replaceChildren();
        // JS indices use UTF-16; server indices use Unicode code points.
        const chars = Array.from(text); let end = 0;
        for (const marker of [...markers].sort((a, b) => a.start - b.start || b.end - a.end)) {
            if (marker.start < end) continue;
            box.append(document.createTextNode(chars.slice(end, marker.start).join('')));
            const mark = document.createElement('mark');
            mark.className = `mark-${marker.category}`; mark.title = labels[marker.category] || marker.category;
            mark.textContent = chars.slice(marker.start, marker.end).join(''); box.append(mark); end = marker.end;
        }
        box.append(document.createTextNode(chars.slice(end).join('')));
    }
    function render(data, topic, text) {
        $('total-score-value').textContent = data.totalScore;
        $('analysis-summary').textContent = data.summary;
        $('topic-relevance').textContent = `Тақырып: ${topic}. ${data.topicRelevance}`;
        $('length-result').textContent = `${data.wordCount} сөз. Таңдалған көлем: ${data.lengthRequirement.min}–${data.lengthRequirement.max}. ${data.lengthInRange ? 'Көлем талапқа сай.' : 'Көлем таңдалған аралықтан тыс.'}`;
        $('criteria-body').replaceChildren(...data.criteria.map(c => {
            const row = document.createElement('tr');
            [c.name, c.score, c.max, c.explanation].forEach(value => { const td = document.createElement('td'); td.textContent = value; row.append(td); });
            return row;
        }));
        list('strengths-list', data.strengths); list('weaknesses-list', data.weaknesses);
        list('recommendations-list', data.recommendations); list('additional-observations', data.additionalObservations);
        list('analysis-limitations', data.limitations);
        highlight(text, data.markers);
        $('annotations-list').replaceChildren(...data.annotations.map(a => {
            const card = document.createElement('div'); card.className = 'annotation';
            const title = document.createElement('strong'); title.textContent = labels[a.category];
            const quote = document.createElement('blockquote'); quote.textContent = a.quote;
            const explanation = document.createElement('p'); explanation.textContent = a.explanation;
            const suggestion = document.createElement('p'); suggestion.textContent = `Ұсыныс: ${a.suggestion}`;
            card.append(title, quote, explanation, suggestion); return card;
        }));
    }
    $('essay-text').addEventListener('input', count);
    $('analyze-btn').addEventListener('click', async () => {
        const topic = $('essay-topic').value.trim(), text = $('essay-text').value.trim();
        const audience = $('essay-audience').value.trim();
        $('analysis-error').hidden = true;
        if (!topic || !text || !audience) {
            $('analysis-error').textContent = 'Тақырыпты, мәтінді және аудиторияны толтырыңыз.';
            $('analysis-error').hidden = false; return;
        }
        $('analyze-btn').disabled = true; show('loading-section');
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({topic, text, audience, essay_type: $('essay-type').value, style: $('essay-style').value, length: $('essay-length').value}),
                signal: AbortSignal.timeout(100000)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Енгізілген мәтін мен баптауларды тексеріңіз.');
            render(data, topic, text); show('result-section');
            try {
                const entries = history(); entries.unshift({date: new Date().toLocaleString('kk-KZ'), topic, text, score: data.totalScore, result: data});
                localStorage.setItem('essayHistory', JSON.stringify(entries.slice(0, 30)));
            } catch { list('analysis-limitations', [...data.limitations, 'Браузер тарихты сақтай алмады.']); }
        } catch (error) {
            show('input-section');
            $('analysis-error').textContent = ['TimeoutError', 'AbortError'].includes(error.name) ? 'Талдаудың күту уақыты аяқталды. Кейін қайталаңыз.' : error instanceof TypeError ? 'Сервермен байланыс орнамады. Қайта көріңіз.' : error.message;
            $('analysis-error').hidden = false;
        } finally { $('analyze-btn').disabled = false; }
    });
    $('download-pdf').addEventListener('click', () => window.print());
    $('reset-btn').addEventListener('click', () => { $('essay-topic').value = ''; $('essay-text').value = ''; count(); show('input-section'); });
    ['nav-home', 'back-to-input', 'back-from-about'].forEach(id => $(id).addEventListener('click', e => { e.preventDefault(); show('input-section'); }));
    ['nav-history', 'view-history'].forEach(id => $(id).addEventListener('click', e => { e.preventDefault(); renderHistory(); show('history-section'); }));
    $('nav-about').addEventListener('click', e => { e.preventDefault(); show('about-section'); });
});
