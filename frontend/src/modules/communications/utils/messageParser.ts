/**
 * Конвертує Markdown та plain text в HTML
 * Підтримує: **bold**, __italic__, [text](url), `code`
 */
export function parseMessageToHtml(content: string, platform: string): string {
  if (!content) return '';
  
  let html = content;
  
  // Екранування HTML (крім того що ми додамо)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Markdown посилання [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g, 
    '<a href="$2" target="_blank" rel="noopener" class="text-blue-600 hover:underline">$1</a>'
  );
  
  // **bold** або __bold__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // *italic* (але не ** і не на початку рядка як список)
  // Спрощений підхід: шукаємо *текст* де текст не містить *
  html = html.replace(/([^\n*])\*([^*\n]+)\*([^\n*])/g, '$1<em>$2</em>$3');
  
  // `code`
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-sm font-mono">$1</code>');
  
  // Emoji hashtags: #tag
  html = html.replace(/#(\w+)/g, '<span class="text-blue-500">#$1</span>');
  
  // URLs без Markdown (https://...)
  // Перевіряємо що це не вже частина посилання
  html = html.replace(
    /(?<!href="|">)(https?:\/\/[^\s<]+)/g, 
    '<a href="$1" target="_blank" rel="noopener" class="text-blue-600 hover:underline break-all">$1</a>'
  );
  
  // Розділювач ----------
  html = html.replace(/^-{5,}$/gm, '<hr class="my-2 border-gray-300">');
  
  // Переноси рядків
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

/**
 * Перевіряє чи контент містить Markdown
 */
export function hasMarkdown(content: string): boolean {
  return /\*\*|\[.+\]\(.+\)|__|`/.test(content);
}

