import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ProcurementRequest, Vendor } from '../types';
import { MOCK_USERS } from '../context/AuthContext';
import { numberToWords } from '../utils/numberToWords';

// Register fonts if needed, but standard fonts are fine for now.
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1c1917',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    paddingBottom: 15,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1c1917',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#78716c',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1c1917',
    marginBottom: 10,
    backgroundColor: '#f5f5f4',
    padding: 6,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  col: {
    flex: 1,
    paddingRight: 10,
  },
  label: {
    fontSize: 9,
    color: '#78716c',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    color: '#1c1917',
    fontFamily: 'Helvetica-Bold',
  },
  description: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 1.4,
  },
  table: {
    width: 'auto',
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    paddingVertical: 6,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f5f5f4',
    fontFamily: 'Helvetica-Bold',
  },
  tableColItem: { flex: 1 },
  tableColQty: { width: 30, textAlign: 'right' },
  tableColCost: { width: 50, textAlign: 'right' },
  tableColRecPrice: { width: 50, textAlign: 'right' },
  tableColAudit1: { width: 50, textAlign: 'right' },
  tableColAudit2: { width: 50, textAlign: 'right' },
  tableColSupplier: { width: 60, textAlign: 'left' },
  tableColFlag: { width: 80, textAlign: 'left' },
  tableColTotal: { width: 50, textAlign: 'right' },
  // Histology Table Columns
  tableColDate: { width: 50, textAlign: 'left' },
  tableColPatient: { width: 80, textAlign: 'left' },
  tableColHosp: { width: 40, textAlign: 'left' },
  tableColLab: { width: 40, textAlign: 'left' },
  tableColService: { width: 80, textAlign: 'left' },
  tableColBill: { width: 50, textAlign: 'right' },
  tableColZMC: { width: 50, textAlign: 'right' },
  tableColReceipt: { width: 50, textAlign: 'left' },
  tableColRetainership: { width: 50, textAlign: 'left' },
  
  tableCell: {
    fontSize: 8,
    paddingHorizontal: 2,
  },
  tableCellHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 2,
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: '#1c1917',
    marginTop: 4,
  },
  totalLabel: {
    width: '75%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    paddingRight: 10,
  },
  totalValue: {
    width: '25%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  signatureBox: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 4,
    width: 200,
  },
  signatureImage: {
    height: 40,
    objectFit: 'contain',
    marginBottom: 5,
  },
  workflowSection: {
    marginTop: 20,
  },
  workflowStep: {
    flexDirection: 'row',
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#fafaf9',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  workflowDetails: {
    flex: 1,
  },
  workflowSignature: {
    height: 30,
    width: 80,
    objectFit: 'contain',
    marginLeft: 10,
  },
  attachmentPage: {
    padding: 0,
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  attachmentHeader: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 4,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});

interface RequestPDFProps {
  request: ProcurementRequest;
  vendors: Vendor[];
}

export default function RequestPDF({ request, vendors }: RequestPDFProps) {
  const getVendorName = (vendorId?: string, manualName?: string) => {
    if (vendorId === 'manual') return manualName || 'Manual Input';
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.name : 'Unknown Vendor';
  };

  const isHistology = request.requestType === 'Histology Payment';
  const isEmergency = request.requestType?.startsWith('Emergency Drug Purchase');
  const isDiesel = request.requestType === 'Diesel Request';
  const isProductProc = request.requestType === 'Product Procurement';
  const isLeave = request.requestType === 'Leave Request';
  const isStoreReq = request.requestType === 'Store Requisition';
  const isIssueStore = request.requestType === 'Issue From Store';

  const hasItems = !isHistology && !isEmergency && !isDiesel && !isLeave && request.items && request.items.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{request.title}</Text>
            <Text style={styles.subtitle}>Request ID: {request.id}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text>{request.status}</Text>
          </View>
        </View>

        {/* Basic Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Request Details</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Request Type</Text>
              <Text style={styles.value}>{request.requestType || 'General'}</Text>
            </View>
            {request.splitSupplier && (
              <View style={styles.col}>
                <Text style={styles.label}>Supplier</Text>
                <Text style={styles.value}>{request.splitSupplier}</Text>
              </View>
            )}
            {request.urgencyLevel && (
              <View style={styles.col}>
                <Text style={styles.label}>Urgency Level</Text>
                <Text style={styles.value}>{request.urgencyLevel}</Text>
              </View>
            )}
            <View style={styles.col}>
              <Text style={styles.label}>Department</Text>
              <Text style={styles.value}>{request.department}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Created By</Text>
              <Text style={styles.value}>{request.createdBy}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Date Submitted</Text>
              <Text style={styles.value}>{format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}</Text>
            </View>
          </View>
          {request.description && request.description !== request.requestType && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>{isDiesel || isLeave ? 'Reason' : 'Description / Justification'}</Text>
              <Text style={styles.description}>{request.description}</Text>
            </View>
          )}
        </View>

        {/* Specific Details */}
        {isHistology && (request.histologyDetailsList || request.histologyDetails) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Histology Details</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={styles.tableColDate}><Text style={styles.tableCellHeader}>Date</Text></View>
                <View style={styles.tableColPatient}><Text style={styles.tableCellHeader}>Patient Name</Text></View>
                <View style={styles.tableColHosp}><Text style={styles.tableCellHeader}>Hosp No.</Text></View>
                <View style={styles.tableColLab}><Text style={styles.tableCellHeader}>Lab No.</Text></View>
                <View style={styles.tableColService}><Text style={styles.tableCellHeader}>Service</Text></View>
                <View style={styles.tableColBill}><Text style={styles.tableCellHeader}>Outsource</Text></View>
                <View style={styles.tableColZMC}><Text style={styles.tableCellHeader}>ZMC</Text></View>
                <View style={styles.tableColReceipt}><Text style={styles.tableCellHeader}>Receipt/HMO</Text></View>
                <View style={styles.tableColRetainership}><Text style={styles.tableCellHeader}>Retainership</Text></View>
              </View>
              {(request.histologyDetailsList || [request.histologyDetails!]).map((detail, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.tableColDate}><Text style={styles.tableCell}>{detail.date}</Text></View>
                  <View style={styles.tableColPatient}><Text style={styles.tableCell}>{detail.patientName}</Text></View>
                  <View style={styles.tableColHosp}><Text style={styles.tableCell}>{detail.hospNo}</Text></View>
                  <View style={styles.tableColLab}><Text style={styles.tableCell}>{detail.labNo}</Text></View>
                  <View style={styles.tableColService}><Text style={styles.tableCell}>{detail.outsourceService}</Text></View>
                  <View style={styles.tableColBill}><Text style={styles.tableCell}>N{(detail.outsourceBill || 0).toLocaleString()}</Text></View>
                  <View style={styles.tableColZMC}><Text style={styles.tableCell}>N{(detail.zmcCharges || 0).toLocaleString()}</Text></View>
                  <View style={styles.tableColReceipt}><Text style={styles.tableCell}>{detail.receiptHmo}</Text></View>
                  <View style={styles.tableColRetainership}><Text style={styles.tableCell}>{detail.retainership}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}

        {isEmergency && request.paymentDetails && (
          <View style={[styles.section, { borderWidth: 1, borderColor: '#e7e5e4', padding: 20 }]}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Payment Advice</Text>
              <Text style={{ fontSize: 10, color: '#78716c', marginTop: 2 }}>Zankli Medical Centre</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={styles.value}>Date: {format(new Date(request.paymentDetails.date), 'MMMM d, yyyy')}</Text>
              <Text style={styles.value}>Ref: {request.id}</Text>
            </View>

            <View style={{ marginBottom: 15, flexDirection: 'row' }}>
              <Text style={{ width: 100, fontFamily: 'Helvetica-Bold', fontSize: 10 }}>Please Pay:</Text>
              <Text style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#d6d3d1', fontSize: 10, paddingBottom: 2 }}>{request.paymentDetails.payee}</Text>
            </View>

            <View style={{ marginBottom: 15, flexDirection: 'row' }}>
              <Text style={{ width: 100, fontFamily: 'Helvetica-Bold', fontSize: 10 }}>The Sum Of:</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ borderBottomWidth: 1, borderBottomColor: '#d6d3d1', fontSize: 10, paddingBottom: 2 }}>
                  {numberToWords(request.paymentDetails.amount)}
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 5 }}>
                  (N{(request.paymentDetails.amount || 0).toLocaleString()})
                </Text>
              </View>
            </View>

            <View style={{ marginBottom: 30, flexDirection: 'row' }}>
              <Text style={{ width: 100, fontFamily: 'Helvetica-Bold', fontSize: 10 }}>Being:</Text>
              <Text style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#d6d3d1', fontSize: 10, paddingBottom: 2 }}>{request.paymentDetails.purpose}</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <View style={{ width: '40%', alignItems: 'center' }}>
                <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: '#d6d3d1', width: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5 }}>
                  {request.creatorSignature && <Image src={request.creatorSignature} style={{ height: 30, objectFit: 'contain' }} />}
                </View>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 5, textTransform: 'uppercase' }}>Prepared By</Text>
                <Text style={{ fontSize: 8, color: '#78716c', marginTop: 2 }}>{request.createdBy}</Text>
              </View>

              {request.approvals && request.approvals.length > 0 && (
                <View style={{ width: '40%', alignItems: 'center' }}>
                  <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: '#d6d3d1', width: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5 }}>
                    {request.approvals[request.approvals.length - 1].signature && (
                      <Image src={request.approvals[request.approvals.length - 1].signature} style={{ height: 30, objectFit: 'contain' }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 5, textTransform: 'uppercase' }}>Authorized By</Text>
                  <Text style={{ fontSize: 8, color: '#78716c', marginTop: 2 }}>
                    {MOCK_USERS.find(u => u.id === request.approvals![request.approvals!.length - 1].approverId)?.department || 'Approver'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {request.requestType === 'Emergency Drug Purchase (1 week)' && request.paymentDetails && (
          <View style={[styles.section, { borderWidth: 1, borderColor: '#e7e5e4', padding: 20, marginTop: 20, borderStyle: 'dashed' }]}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Payment Voucher</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
              <View>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#78716c' }}>Payee:</Text>
                <Text style={{ fontSize: 10, marginTop: 2 }}>{request.paymentDetails.payee}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#78716c' }}>Amount:</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>N{(request.paymentDetails.amount || 0).toLocaleString()}</Text>
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#78716c', marginBottom: 4 }}>Particulars:</Text>
              <View style={{ padding: 10, backgroundColor: '#f5f5f4', borderRadius: 4 }}>
                <Text style={{ fontSize: 10 }}>{request.paymentDetails.purpose}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <View style={{ width: '30%', alignItems: 'center' }}>
                <View style={{ height: 30, borderBottomWidth: 1, borderBottomColor: '#d6d3d1', width: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 }}>
                  {request.creatorSignature && <Image src={request.creatorSignature} style={{ height: 20, objectFit: 'contain' }} />}
                </View>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>Prepared</Text>
              </View>
              <View style={{ width: '30%', alignItems: 'center' }}>
                <View style={{ height: 30, borderBottomWidth: 1, borderBottomColor: '#d6d3d1', width: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 }}>
                  {request.approvals && request.approvals.length > 0 && <Image src={request.approvals[0].signature} style={{ height: 20, objectFit: 'contain' }} />}
                </View>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>Checked</Text>
              </View>
              <View style={{ width: '30%', alignItems: 'center' }}>
                <View style={{ height: 30, borderBottomWidth: 1, borderBottomColor: '#d6d3d1', width: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 }}>
                  {request.approvals && request.approvals.length > 1 && <Image src={request.approvals[request.approvals.length - 1].signature} style={{ height: 20, objectFit: 'contain' }} />}
                </View>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>Authorized</Text>
              </View>
            </View>
          </View>
        )}

        {isDiesel && request.dieselDetails && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Diesel Requisition Details</Text>
            <View style={styles.row}>
              <View style={styles.col}><Text style={styles.label}>Date of Requisition</Text><Text style={styles.value}>{request.dieselDetails.dateOfRequisition}</Text></View>
              <View style={styles.col}><Text style={styles.label}>Issuer Name</Text><Text style={styles.value}>{request.dieselDetails.issuerName}</Text></View>
              <View style={styles.col}><Text style={styles.label}>Volume (Liters)</Text><Text style={styles.value}>{(request.dieselDetails.volumeLiters || 0).toLocaleString()}</Text></View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}><Text style={styles.label}>Diesel Remaining</Text><Text style={styles.value}>{(request.dieselDetails.dieselRemainingLiters || 0).toLocaleString()}</Text></View>
              <View style={styles.col}><Text style={styles.label}>Cost per Liter</Text><Text style={styles.value}>N{(request.dieselDetails.costPerLiter || 0).toLocaleString()}</Text></View>
              <View style={styles.col}><Text style={styles.label}>Vendor</Text><Text style={styles.value}>{getVendorName(request.dieselDetails.vendorId, request.dieselDetails.manualVendorName)}</Text></View>
            </View>
          </View>
        )}

        {isLeave && request.leaveDetails && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leave Details</Text>
            <View style={styles.row}>
              <View style={styles.col}><Text style={styles.label}>Date of Requisition</Text><Text style={styles.value}>{request.leaveDetails.dateOfRequisition}</Text></View>
              <View style={styles.col}><Text style={styles.label}>Issuer Name</Text><Text style={styles.value}>{request.leaveDetails.issuerName}</Text></View>
              <View style={styles.col}><Text style={styles.label}>Applicant Name</Text><Text style={styles.value}>{request.leaveDetails.applicantName}</Text></View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}><Text style={styles.label}>Start Date</Text><Text style={styles.value}>{request.leaveDetails.startDate}</Text></View>
              <View style={styles.col}><Text style={styles.label}>End Date</Text><Text style={styles.value}>{request.leaveDetails.endDate}</Text></View>
              <View style={styles.col}><Text style={styles.label}>Leave Days</Text><Text style={styles.value}>{request.leaveDetails.numberOfLeaveDays || request.leaveDetails.daysRemaining}</Text></View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}><Text style={styles.label}>Remaining Leave Days</Text><Text style={styles.value}>{request.leaveDetails.daysRemaining}</Text></View>
              <View style={styles.col}><Text style={styles.label}>Purpose</Text><Text style={[styles.value, { textTransform: 'capitalize' }]}>{request.leaveDetails.purpose}</Text></View>
              <View style={styles.col}></View>
            </View>
            {request.leaveDetails.headOfDepartmentComment && (
              <View style={[styles.row, { marginTop: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Head of Department Comment</Text>
                  <Text style={[styles.value, { marginTop: 4, padding: 8, backgroundColor: '#f5f5f4', borderRadius: 4 }]}>
                    {request.leaveDetails.headOfDepartmentComment}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Items Table */}
        {hasItems && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requested Items</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={styles.tableColItem}><Text style={styles.tableCellHeader}>Item</Text></View>
                <View style={styles.tableColQty}><Text style={styles.tableCellHeader}>Qty</Text></View>
                <View style={styles.tableColCost}><Text style={styles.tableCellHeader}>Est. Cost</Text></View>
                {request.items.some(i => i.recommendedPrice) && (
                  <View style={styles.tableColRecPrice}><Text style={styles.tableCellHeader}>Store Rec.</Text></View>
                )}
                {request.items.some(i => i.audit1RecommendedPrice) && (
                  <View style={styles.tableColAudit1}><Text style={styles.tableCellHeader}>Audit 1 Rec.</Text></View>
                )}
                {request.items.some(i => i.audit2RecommendedPrice) && (
                  <View style={styles.tableColAudit2}><Text style={styles.tableCellHeader}>Audit 2 Rec.</Text></View>
                )}
                {request.items.some(i => i.supplier) && (
                  <View style={styles.tableColSupplier}><Text style={styles.tableCellHeader}>Supplier</Text></View>
                )}
                {request.items.some(i => i.flagged) && (
                  <View style={styles.tableColFlag}><Text style={styles.tableCellHeader}>Flag Reason</Text></View>
                )}
                <View style={styles.tableColTotal}><Text style={styles.tableCellHeader}>Total</Text></View>
              </View>
              {request.items.map((item, i) => (
                <View key={i} style={[styles.tableRow, item.flagged ? { backgroundColor: '#fef2f2' } : {}]}>
                  <View style={styles.tableColItem}>
                    <Text style={styles.tableCell}>{item.name}</Text>
                    {item.description && <Text style={{ fontSize: 7, color: '#78716c', paddingHorizontal: 2 }}>{item.description}</Text>}
                  </View>
                  <View style={styles.tableColQty}><Text style={styles.tableCell}>{item.quantity}</Text></View>
                  <View style={styles.tableColCost}><Text style={styles.tableCell}>N{(item.estimatedCost || 0).toLocaleString()}</Text></View>
                  {request.items.some(i => i.recommendedPrice) && (
                    <View style={styles.tableColRecPrice}>
                      <Text style={styles.tableCell}>{item.recommendedPrice ? `N${item.recommendedPrice.toLocaleString()}` : '-'}</Text>
                    </View>
                  )}
                  {request.items.some(i => i.audit1RecommendedPrice) && (
                    <View style={styles.tableColAudit1}>
                      <Text style={styles.tableCell}>{item.audit1RecommendedPrice ? `N${item.audit1RecommendedPrice.toLocaleString()}` : '-'}</Text>
                      {item.audit1DifferenceReason && <Text style={{ fontSize: 6, color: '#78716c', fontStyle: 'italic' }}>{item.audit1DifferenceReason}</Text>}
                    </View>
                  )}
                  {request.items.some(i => i.audit2RecommendedPrice) && (
                    <View style={styles.tableColAudit2}>
                      <Text style={styles.tableCell}>{item.audit2RecommendedPrice ? `N${item.audit2RecommendedPrice.toLocaleString()}` : '-'}</Text>
                      {item.audit2DifferenceReason && <Text style={{ fontSize: 6, color: '#78716c', fontStyle: 'italic' }}>{item.audit2DifferenceReason}</Text>}
                    </View>
                  )}
                  {request.items.some(i => i.supplier) && (
                    <View style={styles.tableColSupplier}>
                      <Text style={styles.tableCell}>{item.supplier || '-'}</Text>
                    </View>
                  )}
                  {request.items.some(i => i.flagged) && (
                    <View style={styles.tableColFlag}>
                      <Text style={[styles.tableCell, { color: '#dc2626' }]}>{item.flagReason || 'Flagged'}</Text>
                    </View>
                  )}
                  <View style={styles.tableColTotal}>
                    <Text style={styles.tableCell}>N{((item.quantity || 0) * (item.recommendedPrice || item.estimatedCost || 0)).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalValue}>
                  N{request.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.recommendedPrice || item.estimatedCost || 0)), 0).toLocaleString()}
                </Text>
              </View>
              {request.recommendedAmount !== undefined && (
                <View style={[styles.totalRow, { backgroundColor: '#fff7ed', borderTopWidth: 1, borderTopColor: '#fdba74' }]}>
                  <Text style={[styles.totalLabel, { color: '#c2410c' }]}>Auditor Recommended Total:</Text>
                  <Text style={[styles.totalValue, { color: '#c2410c', fontSize: 14 }]}>
                    N{request.recommendedAmount.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Total Amount for specific types */}
        {(isHistology || isEmergency || isDiesel) && (
          <View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalValue}>N{(request.totalAmount || 0).toLocaleString()}</Text>
            </View>
            {request.recommendedAmount !== undefined && (
              <View style={[styles.totalRow, { backgroundColor: '#fff7ed', borderTopWidth: 1, borderTopColor: '#fdba74' }]}>
                <Text style={[styles.totalLabel, { color: '#c2410c' }]}>Auditor Recommended Total:</Text>
                <Text style={[styles.totalValue, { color: '#c2410c', fontSize: 14 }]}>
                  N{request.recommendedAmount.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {!hasItems && !(isHistology || isEmergency || isDiesel) && request.recommendedAmount !== undefined && (
          <View style={[styles.totalRow, { backgroundColor: '#fff7ed', borderTopWidth: 1, borderTopColor: '#fdba74', marginTop: 10 }]}>
            <Text style={[styles.totalLabel, { color: '#c2410c' }]}>Auditor Recommended Total:</Text>
            <Text style={[styles.totalValue, { color: '#c2410c', fontSize: 14 }]}>
              N{request.recommendedAmount.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Creator Signature */}
        {request.creatorSignature && (
          <View style={styles.signatureBox}>
            <Text style={styles.label}>Creator Signature</Text>
            <Image src={request.creatorSignature} style={styles.signatureImage} />
            <Text style={{ fontSize: 8, color: '#78716c' }}>Signed by {request.createdBy}</Text>
          </View>
        )}

        {/* Workflow / Approvals */}
        <View style={styles.workflowSection}>
          <Text style={styles.sectionTitle}>Approval Workflow</Text>
          
          {request.workflow && request.workflow.length > 0 ? (
            request.workflow.map((approverId, index) => {
              const approver = MOCK_USERS.find(u => u.id === approverId);
              const approvalRecord = request.approvals?.find((a, i) => i === index);
              const voidRecord = request.voidedApprovers?.find(v => v.approverId === approverId);
              
              if (!approvalRecord && !voidRecord) return null;

              if (voidRecord) {
                return (
                  <View key={index} style={styles.workflowStep}>
                    <View style={styles.workflowDetails}>
                      <Text style={[styles.value, { textDecoration: 'line-through', color: '#a8a29e' }]}>Step {index + 1}: {approver?.department} ({approver?.email})</Text>
                      <Text style={{ fontSize: 9, color: '#78716c', marginTop: 2 }}>
                        Voided on {format(new Date(voidRecord.date), 'MMM d, yyyy h:mm a')}
                      </Text>
                      <Text style={{ fontSize: 9, marginTop: 4, fontStyle: 'italic', color: '#78716c' }}>"{voidRecord.reason}"</Text>
                    </View>
                  </View>
                );
              }

              return (
                <View key={index} style={styles.workflowStep}>
                  <View style={styles.workflowDetails}>
                    <Text style={styles.value}>Step {index + 1}: {approver?.department} ({approver?.email})</Text>
                    <Text style={{ fontSize: 9, color: approvalRecord.status === 'Approved' ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                      {approvalRecord.status} on {format(new Date(approvalRecord.date), 'MMM d, yyyy h:mm a')}
                    </Text>
                    {approvalRecord.notes && (
                      <Text style={{ fontSize: 9, marginTop: 4, fontStyle: 'italic' }}>"{approvalRecord.notes}"</Text>
                    )}
                  </View>
                  {approvalRecord.signature && (
                    <Image src={approvalRecord.signature} style={styles.workflowSignature} />
                  )}
                </View>
              );
            })
          ) : (
            <>
              {request.auditSignature && (
                <View style={styles.workflowStep}>
                  <View style={styles.workflowDetails}>
                    <Text style={styles.value}>Audit Review</Text>
                    <Text style={{ fontSize: 9, color: '#16a34a', marginTop: 2 }}>Reviewed</Text>
                    {request.auditNotes && <Text style={{ fontSize: 9, marginTop: 4, fontStyle: 'italic' }}>"{request.auditNotes}"</Text>}
                  </View>
                  <Image src={request.auditSignature} style={styles.workflowSignature} />
                </View>
              )}
              {request.accountsSignature && (
                <View style={styles.workflowStep}>
                  <View style={styles.workflowDetails}>
                    <Text style={styles.value}>Accounts Approval</Text>
                    <Text style={{ fontSize: 9, color: '#16a34a', marginTop: 2 }}>Approved</Text>
                    {request.accountsNotes && <Text style={{ fontSize: 9, marginTop: 4, fontStyle: 'italic' }}>"{request.accountsNotes}"</Text>}
                  </View>
                  <Image src={request.accountsSignature} style={styles.workflowSignature} />
                </View>
              )}
            </>
          )}
        </View>
      </Page>

      {/* Attachment Pages */}
      {request.attachments?.map((att, index) => {
        // We only render images directly in @react-pdf/renderer
        // PDFs will be merged post-generation using pdf-lib
        if (att.type.includes('image')) {
          return (
            <Page key={index} size="A4" style={styles.attachmentPage}>
              <View style={styles.attachmentHeader}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12 }}>Attachment: {att.name}</Text>
                <Text style={{ fontSize: 10, color: '#78716c' }}>Image Preview</Text>
              </View>
              <Image src={att.data} style={styles.attachmentImage} />
            </Page>
          );
        }
        return null;
      })}
    </Document>
  );
}
