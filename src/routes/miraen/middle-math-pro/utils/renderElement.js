// src/routes/miraen/middle-math-pro/utils/renderElement.js
import katex from 'katex';

function cleanLatex(latex) {
  if (!latex) return '';
  
  // 한글 원문자와 특수 문자를 일반 텍스트로 처리
  const specialChars = {
    '㉠': '\\text{㉠}',
    '㉡': '\\text{㉡}',
    '㉢': '\\text{㉢}',
    '㉣': '\\text{㉣}',
    '㉤': '\\text{㉤}',
    '㈎': '\\text{㈎}',
    '㈏': '\\text{㈏}',
    '㈐': '\\text{㈐}',
    '㈑': '\\text{㈑}',
    '㈒': '\\text{㈒}',
    '◻': '\\square',
    '□': '\\square',
    '⇨': '\\Rightarrow',
    '∴': '\\therefore',
    '⋯': '\\cdots',
    '×': '\\times',
    '÷': '\\div',
    '±': '\\pm',
  };
  
  // 특수 문자 변환
  let result = latex;
  for (const [char, replacement] of Object.entries(specialChars)) {
    result = result.replace(new RegExp(char, 'g'), replacement);
  }
  
  // HTML 엔티티를 실제 기호로 변환
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  result = result.replace(/&amp;/g, '&');
  
  // therefore 기호 처리
  result = result.replace(/∴\\mathit{/g, '\\therefore\\;\\mathit{');
  result = result.replace(/∴(\w)/g, '\\therefore\\;{$1}');
  result = result.replace(/∴/g, '\\therefore');
  
  // \bbox 명령어 처리
  result = result.replace(/\\bbox\[([^\]]*)\]{([^{}]*|{[^{}]*})*}/g, '$2');
  
  // 수식 기호 및 공백 처리
  result = result.replace(/×/g, '\\times');
  result = result.replace(/\\mathrm{([^}]*)}/g, (match, p1) => 
    `\\mathrm{${p1.replace(/\s+/g, '')}}`
  );
  result = result.replace(/ﾠ/g, '\\;');
  result = result.replace(/\\,\s*\\,/g, '\\,');
  result = result.replace(/\s*,\s*/g, ',\\,');
  result = result.replace(/\\times\s*([A-Za-z])/g, '\\times $1');
  result = result.replace(/([<>])/g, ' $1 ');
  
  return result;
}

export function renderElement(element) {
  if (!element) return '';
  
  const styleString = element.styles ? 
    Object.entries(element.styles)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(';')
    : '';
  
  switch(element.type) {
    case 'table':
      return `<table class="w-full" style="width: ${element.width}px">
        ${element.children.map(renderElement).join('')}
      </table>`;
      
    case 'row':
      return `<tr>${element.children.map(renderElement).join('')}</tr>`;
      
    case 'cell':
      return `<td style="${styleString}; width: ${element.width}; height: ${element.height}px">
        ${element.children.map(renderElement).join('')}
      </td>`;
      
    case 'char':
      return `<span style="${styleString}">
        ${element.children.map(renderElement).join('')}
      </span>`;
      
    case 'equation':
      try {
        const cleanedLatex = cleanLatex(element.content);
        const html = katex.renderToString(cleanedLatex, {
          throwOnError: false,
          displayMode: false,
          strict: false,
          trust: true,
          output: 'html',
          macros: {
            '\\bbox': '\\htmlClass{bbox-highlight}{#2}'
          }
        });
        return `<span class="inline-block mx-1" style="${styleString}">${html}</span>`;
      } catch (e) {
        console.error('LaTeX 렌더링 에러:', e, element.content);
        return element.content || '';
      }
      
    case 'input':
      const classes = ['border', 'rounded', 'px-2', 'py-1'].join(' ');
      return `<input type="text" class="${classes}" 
        style="${styleString}; width: ${element.width}px; height: ${element.height}px">`;
      
    case 'linebreak':
      return '<br>';
      
    case 'choice':
      return `<div class="mt-4 space-y-2">
        ${element.children.map(renderElement).join('')}
      </div>`;
      
    case 'item':
      return `<div class="flex items-start gap-2">
        ${element.children.map(renderElement).join('')}
      </div>`;
      
    case 'itempoint':
      return `<div class="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300">
        ${element.num}
      </div>`;
      
    case 'underline':
      return `<span class="underline">
        ${element.children.map(renderElement).join('')}
      </span>`;
      
    case 'image':
      return `<img 
        src="data:image/png;base64,${element.data}"
        width="${element.width || 'auto'}"
        height="${element.height || 'auto'}"
        style="${styleString}"
        alt="Problem image"
        class="my-2"
      >`;
      
    case 'text':
    default:
      return element.content || '';
  }
} 