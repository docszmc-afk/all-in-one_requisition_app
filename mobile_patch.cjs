const fs = require('fs');
let code = fs.readFileSync('src/pages/TaskBoard.tsx', 'utf8');

// Container height
code = code.replace(
  "h-[calc(100vh-64px)]",
  "h-[calc(100dvh-64px)]"
);

// Header padding
code = code.replace(
  "bg-white p-6 rounded-2xl shadow-sm border border-stone-100 gap-4 mb-6",
  "bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-stone-100 gap-3 md:gap-4 mb-4 md:mb-6"
);

// Select box padding mobile
code = code.replace(
  "flex items-center gap-3 w-full md:w-auto",
  "flex items-center gap-2 md:gap-3 w-full md:w-auto"
);

// Kanban scroll area snap
code = code.replace(
  "className=\"flex-1 overflow-x-auto pb-4\"",
  "className=\"flex-1 overflow-x-auto pb-4 snap-x snap-mandatory\""
);

code = code.replace(
  "className=\"flex gap-6 h-full min-w-max px-2\"",
  "className=\"flex gap-4 md:gap-6 h-full min-w-max px-4 md:px-2\""
);

// Columns
code = code.replace(
  "className=\"w-80 flex flex-col bg-stone-100/50 rounded-2xl border border-stone-200/60 shrink-0 h-full\"",
  "className=\"w-[85vw] max-w-[320px] md:w-80 flex flex-col bg-stone-100/50 rounded-2xl border border-stone-200/60 shrink-0 h-full snap-center md:snap-align-none\""
);

// Task Action Buttons (always visible on mobile)
code = code.replace(
  "className=\"flex gap-2 mt-3 pt-3 border-t border-stone-100 opacity-0 group-hover:opacity-100 transition-opacity\"",
  "className=\"flex gap-2 mt-3 pt-3 border-t border-stone-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity\""
);

// Make buttons slightly more tappable on mobile
code = code.replace(
  "className=\"flex-1 py-1.5 bg-stone-50 text-stone-600 rounded-lg text-xs hover:bg-stone-200\"",
  "className=\"flex-1 py-2 md:py-1.5 bg-stone-50 text-stone-600 rounded-lg text-xs hover:bg-stone-200 font-medium\""
);
code = code.replace(
  "className=\"flex-1 py-1.5 bg-stone-50 text-stone-600 rounded-lg text-xs hover:bg-stone-200\"",
  "className=\"flex-1 py-2 md:py-1.5 bg-stone-50 text-stone-600 rounded-lg text-xs hover:bg-stone-200 font-medium\""
);
code = code.replace(
  "className=\"flex-1 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs hover:bg-emerald-100\"",
  "className=\"flex-1 py-2 md:py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs hover:bg-emerald-100 font-medium\""
);

// Task Modal Bottom Sheet on Mobile
code = code.replace(
  "className=\"fixed inset-0 bg-stone-900/60 flex items-center justify-center z-50 p-4\"",
  "className=\"fixed inset-0 bg-stone-900/60 flex items-end md:items-center justify-center z-50 md:p-4\""
);
code = code.replace(
  "className=\"bg-white rounded-3xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90dvh]\"",
  "className=\"bg-white rounded-t-3xl md:rounded-3xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90dvh]\""
);

// Title padding
code = code.replace(
  "className=\"p-6 border-b border-stone-100 flex justify-between items-start\"",
  "className=\"p-5 md:p-6 border-b border-stone-100 flex justify-between items-start\""
);
code = code.replace(
  "className=\"p-6 overflow-y-auto flex-1 space-y-8\"",
  "className=\"p-5 md:p-6 overflow-y-auto flex-1 space-y-6 md:space-y-8\""
);

fs.writeFileSync('src/pages/TaskBoard.tsx', code);
