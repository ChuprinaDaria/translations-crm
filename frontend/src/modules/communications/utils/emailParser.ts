/**
 * Конвертує plain text email в HTML
 * Обробляє:
 * - **жирний текст** → <strong>
 * - *курсив* → <em>
 * - Посилання в <url> або https://... → <a href>
 * - Списки з * або - → <ul><li>
 * - Розділювачі ---------- → <hr>
 * - Переноси рядків → <br> або <p>
 */
export function parseEmailToHtml(content: string): string {
  if (!content) return '';
  
  let html = content;
  
  // Спочатку обробляємо списки, щоб не конфліктувати з курсивом
  // Позначаємо рядки списків спеціальним маркером
  const listItems: string[] = [];
  html = html.replace(/^[\*\-]\s+(.+)$/gm, (match, content) => {
    const marker = `__LIST_ITEM_${listItems.length}__`;
    listItems.push(content);
    return marker;
  });
  
  // Екранування HTML спецсимволів (крім тих що ми будемо використовувати)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Розділювач ---------- → <hr>
  html = html.replace(/^-{5,}$/gm, '<hr class="my-3 border-gray-300">');
  
  // Посилання в &lt;url&gt; форматі (вже екрановані)
  html = html.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener" class="text-blue-600 hover:underline break-all">$1</a>');
  
  // Звичайні посилання https://...
  html = html.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener" class="text-blue-600 hover:underline break-all">$2</a>');
  
  // **жирний** → <strong> (спочатку обробляємо жирний, щоб не конфліктувати з курсивом)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // *курсив* (тільки якщо не на початку рядка і не частина жирного)
  // Спрощений підхід: шукаємо *текст* де текст не містить *
  html = html.replace(/([^\n*])\*([^*\n]+)\*([^\n*])/g, '$1<em>$2</em>$3');
  
  // Відновлюємо списки (після обробки форматування)
  listItems.forEach((item, index) => {
    const marker = `__LIST_ITEM_${index}__`;
    // Обробляємо форматування всередині елементів списку
    let processedItem = item;
    processedItem = processedItem.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processedItem = processedItem.replace(/([^\n*])\*([^*\n]+)\*([^\n*])/g, '$1<em>$2</em>$3');
    html = html.replace(marker, `<li class="ml-4">${processedItem}</li>`);
  });
  
  // Групуємо послідовні <li> в <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>(?:\s*<br>)?\s*)+/g, (match) => {
    return `<ul class="list-disc list-inside my-2">${match.replace(/<br>\s*$/g, '')}</ul>`;
  });
  
  // Подвійні переноси → параграфи
  html = html.replace(/\n\n+/g, '</p><p class="my-2">');
  
  // Одинарні переноси → <br>
  html = html.replace(/\n/g, '<br>');
  
  // Обгортаємо в <p>
  html = '<p class="my-2">' + html + '</p>';
  
  // Чистимо пусті параграфи
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');
  
  return html;
}

/**
 * Перевіряє чи контент схожий на email (має типові email патерни)
 */
export function looksLikeEmail(content: string): boolean {
  const emailPatterns = [
    /^Від:/m,
    /^From:/m,
    /^Тема:/m,
    /^Subject:/m,
    /^-{5,}$/m,
    /Message type:/i,
  ];
  
  return emailPatterns.some(pattern => pattern.test(content));
}

