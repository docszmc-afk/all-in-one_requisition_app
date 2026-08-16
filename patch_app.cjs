const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "import { VoucherProvider } from './context/VoucherContext';",
  "import { VoucherProvider } from './context/VoucherContext';\nimport { TaskProvider } from './context/TaskContext';"
);

code = code.replace(
  "import Vouchers from './pages/Vouchers';",
  "import Vouchers from './pages/Vouchers';\nimport TaskBoard from './pages/TaskBoard';"
);

code = code.replace(
  "<VoucherProvider>",
  "<VoucherProvider>\n                        <TaskProvider>"
);

code = code.replace(
  "</VoucherProvider>",
  "</TaskProvider>\n                      </VoucherProvider>"
);

code = code.replace(
  "<Route path=\"vouchers\" element={<Vouchers />} />",
  "<Route path=\"vouchers\" element={<Vouchers />} />\n                              <Route path=\"task-boards\" element={<TaskBoard />} />"
);

fs.writeFileSync('src/App.tsx', code);
