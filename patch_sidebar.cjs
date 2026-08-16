const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace(
  "import { useVouchers } from '../context/VoucherContext';",
  "import { useVouchers } from '../context/VoucherContext';\nimport { useTasks } from '../context/TaskContext';"
);

code = code.replace(
  "const { vouchers } = useVouchers();",
  "const { vouchers } = useVouchers();\n  const { tasks: kanbanTasks } = useTasks();"
);

code = code.replace(
  "const workspaceBadge = tasks.filter(t => t.status !== 'Done').length;",
  "const workspaceBadge = tasks.filter(t => t.status !== 'Done').length;\n  const kanbanBadge = kanbanTasks.filter(t => t.status !== 'done').length;"
);

// We need to add the Trello link for those specific users.
code = code.replace(
  "    ...(user?.department === 'Facility' || user?.email === 'zanklihr@gmail.com' || user?.email === 'docs.zmc@gmail.com' ? [\n      { to: '/workspace', icon: Briefcase, label: 'Facility Workspace', badge: workspaceBadge > 0 ? workspaceBadge : undefined }\n    ] : []),",
  "    ...(user?.department === 'Facility' || user?.email === 'zanklihr@gmail.com' || user?.email === 'docs.zmc@gmail.com' ? [\n      { to: '/workspace', icon: Briefcase, label: 'Facility Workspace', badge: workspaceBadge > 0 ? workspaceBadge : undefined },\n      { to: '/task-boards', icon: List, label: 'Task Management', badge: kanbanBadge > 0 ? kanbanBadge : undefined }\n    ] : []),"
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
