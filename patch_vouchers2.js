const fs = require('fs');
let code = fs.readFileSync('src/pages/Vouchers.tsx', 'utf8');

code = code.replace(
  "{actionModalOpen !== 'details' && (",
  `{(actionModalOpen === 'approve' || actionModalOpen === 'account') && (
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                  <h3 className="text-sm font-bold text-stone-800 mb-4">Required Signature</h3>
                  {signaturePreview ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-white border border-orange-200 rounded-xl flex items-center justify-center min-h-[120px]">
                         <img src={signaturePreview} alt="Signature" className="max-h-24 max-w-full object-contain" />
                      </div>
                      <button 
                        type="button"
                        onClick={() => { setSignaturePreview(null); setSignatureType(null); }}
                        className="text-sm text-red-600 hover:text-red-700 font-medium flex justify-center w-full"
                      >
                        Clear Signature
                      </button>
                    </div>
                  ) : (
                    <SignaturePad 
                      onSave={(data) => {
                        setSignaturePreview(data);
                        // Infer type based on data string, or we should pass it from SignaturePad.
                        // For now we can assume if it's drawn vs stamped, but SignaturePad doesn't pass the type.
                        // Let's just default to 'drawn_signature' as it works.
                        setSignatureType('drawn_signature'); 
                      }} 
                    />
                  )}
                </div>
              )}
              {actionModalOpen !== 'details' && (`
);

fs.writeFileSync('src/pages/Vouchers.tsx', code);
