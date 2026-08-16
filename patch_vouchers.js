const fs = require('fs');
let code = fs.readFileSync('src/pages/Vouchers.tsx', 'utf8');

code = code.replace(
  "import { \n  Plus, Search, Filter",
  "import SignaturePad from '../components/SignaturePad';\nimport jsPDF from 'jspdf';\nimport 'jspdf-autotable';\nimport { \n  Plus, Search, Filter"
);

code = code.replace(
  "const { vouchers, loading, createVoucher, updateVoucherStatus, queryVoucher, updateVoucherContent } = useVouchers();",
  "const { vouchers, approvals, loading, createVoucher, updateVoucherStatus, queryVoucher, updateVoucherContent, addApproval } = useVouchers();"
);

code = code.replace(
  "const [actionModalOpen, setActionModalOpen] = useState<'approve' | 'account' | 'query' | 'details' | null>(null);",
  "const [actionModalOpen, setActionModalOpen] = useState<'approve' | 'account' | 'query' | 'details' | null>(null);\n  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);\n  const [signatureType, setSignatureType] = useState<'password_stamp' | 'drawn_signature' | null>(null);"
);

code = code.replace(
  "const handleApproveAction = async (status: 'approved' | 'rejected' | 'sent_back') => {",
  "const handleApproveAction = async (status: 'approved' | 'rejected' | 'sent_back') => {\n    if (status === 'approved' && !signaturePreview) {\n      toast.error('You must sign or stamp to approve');\n      return;\n    }"
);

code = code.replace(
  "await updateVoucherStatus(selectedVoucher.id, status, user.email, comments);",
  "await updateVoucherStatus(selectedVoucher.id, status, user.email, comments);\n      if (status === 'approved' && signaturePreview && signatureType) {\n        await addApproval({ voucher_id: selectedVoucher.id, user_email: user.email, role: user.department, signature_type: signatureType, signature_data: signaturePreview });\n      }"
);

// Account process needs signature too? The request says "all approvers (plus accounts)"
code = code.replace(
  "const handleAccountAction = async (status: 'final_payable' | 'negotiated') => {",
  "const handleAccountAction = async (status: 'final_payable' | 'negotiated') => {\n    if (!signaturePreview) {\n      toast.error('You must sign or stamp to process');\n      return;\n    }"
);

code = code.replace(
  "Number(finalAmount)\n      );",
  "Number(finalAmount)\n      );\n      if (signaturePreview && signatureType) {\n        await addApproval({ voucher_id: selectedVoucher.id, user_email: user.email, role: 'Accounts', signature_type: signatureType, signature_data: signaturePreview });\n      }"
);

code = code.replace(
  "const handleBulkPrint = () => {\n    window.print();\n  };",
  `const handleBulkPrint = () => {
    // Generate PDF Ledger using jspdf
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.text('Payment Vouchers Ledger', 14, 22);
    
    doc.setFontSize(11);
    doc.text(\`Generated: \${new Date().toLocaleString()}\`, 14, 30);
    
    const tableData = selectedVoucherIds.map(id => {
      const v = vouchers.find(v => v.id === id);
      const aps = approvals.filter(a => a.voucher_id === id);
      if (!v) return [];
      
      const approverNames = aps.map(a => a.user_email.split('@')[0]).join(', ');
      
      return [
        new Date(v.created_at).toLocaleDateString(),
        v.title,
        v.department,
        v.payee_name,
        \`\${Number(v.amount_requested).toLocaleString()}\`,
        v.status.replace('_', ' ').toUpperCase(),
        approverNames || 'None'
      ];
    }).filter(row => row.length > 0);
    
    (doc as any).autoTable({
      startY: 40,
      head: [['Date', 'Title', 'Dept', 'Payee', 'Amount', 'Status', 'Approvers']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [234, 88, 12] }
    });
    
    // Add images for signatures at the end if needed, but for a ledger list, just names is better.
    // If we want to append signatures, we could render them in cells, but base64 strings can be large.
    
    doc.save('Vouchers_Ledger.pdf');
  };`
);


// Clear signature on close
code = code.replace(
  "onClick={() => { setActionModalOpen(null); setComments(''); }}",
  "onClick={() => { setActionModalOpen(null); setComments(''); setSignaturePreview(null); setSignatureType(null); }}"
);
code = code.replace(
  "onClick={() => { setActionModalOpen(null); setComments(''); }}",
  "onClick={() => { setActionModalOpen(null); setComments(''); setSignaturePreview(null); setSignatureType(null); }}"
);

fs.writeFileSync('src/pages/Vouchers.tsx', code);
