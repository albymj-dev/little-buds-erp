import ExcelJS from 'exceljs';
import { formatDate } from './dateUtils';

/**
 * Institutional & Executive Excel Styler for Little Buds Child Care Centre
 * Provides Big-4 / Wall Street grade formatting for Excel workbooks.
 */

export const EXCEL_COLORS = {
  navyDark: 'FF0F172A',      // Slate-900 (Main Title)
  navyHeader: 'FF1E293B',    // Slate-800 (Table Headers)
  indigoPrimary: 'FF312E81', // Indigo-900
  indigoAccent: 'FF4338CA',  // Indigo-700
  indigoSubtle: 'FFEEF2FF',  // Indigo-50 (Category / Section rows)
  slateLight: 'FFF1F5F9',    // Slate-100 (Metadata block)
  zebraWhite: 'FFFFFFFF',    // Row alternating
  zebraLight: 'FFF8FAFC',    // Slate-50 alternating
  totalRowFill: 'FFE2E8F0',  // Slate-200 (Grand Total)
  subtotalFill: 'FFF1F5F9',  // Slate-100 (Subtotal)
  successGreen: 'FF059669',  // Emerald-600
  successBg: 'FFECFDF5',     // Emerald-50
  dangerRed: 'FFDC2626',     // Rose-600
  dangerBg: 'FFFEF2F2',      // Rose-50
  borderLight: 'FFE2E8F0',   // Slate-200
  borderMedium: 'FF94A3B8',  // Slate-400
  borderDark: 'FF0F172A'     // Slate-900
};

export const NUMBER_FORMATS = {
  currency: '₹ #,##0.00;[Red](₹ #,##0.00);"-"',
  currencyRounded: '₹ #,##0;[Red](₹ #,##0);"-"',
  decimal: '#,##0.00;(#,##0.00);"-"',
  integer: '#,##0',
  percentage: '0.0%'
};

export const BORDERS = {
  thin: {
    top: { style: 'thin' as const, color: { argb: EXCEL_COLORS.borderLight } },
    left: { style: 'thin' as const, color: { argb: EXCEL_COLORS.borderLight } },
    bottom: { style: 'thin' as const, color: { argb: EXCEL_COLORS.borderLight } },
    right: { style: 'thin' as const, color: { argb: EXCEL_COLORS.borderLight } }
  },
  header: {
    top: { style: 'medium' as const, color: { argb: EXCEL_COLORS.navyDark } },
    left: { style: 'thin' as const, color: { argb: EXCEL_COLORS.borderMedium } },
    bottom: { style: 'medium' as const, color: { argb: EXCEL_COLORS.navyDark } },
    right: { style: 'thin' as const, color: { argb: EXCEL_COLORS.borderMedium } }
  },
  total: {
    top: { style: 'thin' as const, color: { argb: EXCEL_COLORS.borderMedium } },
    bottom: { style: 'double' as const, color: { argb: EXCEL_COLORS.navyDark } }
  }
};

/**
 * Creates a 3-row executive corporate title header block on the given worksheet.
 * Returns the next row number (Row 5) where table column headers should begin.
 */
export const addExecutiveReportHeader = (
  ws: ExcelJS.Worksheet,
  params: {
    title: string;
    subtitle?: string;
    colSpan: number;
    periodLabel?: string;
    asOfDate?: string | Date;
    tagline?: string;
    themeColor?: string;
    organizationName?: string;
  }
): number => {
  const {
    title,
    subtitle,
    colSpan,
    periodLabel,
    asOfDate,
    tagline,
    themeColor,
    organizationName = 'Little Buds Child Care Centre'
  } = params;
  const lastColChar = String.fromCharCode(64 + Math.min(colSpan, 26));

  // Row 1: Brand / Organisation Title Banner
  ws.mergeCells(`A1:${lastColChar}1`);
  const r1 = ws.getCell('A1');
  r1.value = organizationName;
  r1.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  r1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: themeColor || EXCEL_COLORS.navyDark }
  };
  ws.getRow(1).height = 32;

  // Row 2: Report Name (Title) & Subtitle
  ws.mergeCells(`A2:${lastColChar}2`);
  const r2 = ws.getCell('A2');
  const fullTitle = subtitle ? `${title.toUpperCase()} — ${subtitle.toUpperCase()}` : title.toUpperCase();
  r2.value = fullTitle;
  r2.font = { name: 'Calibri', size: 11.5, bold: true, color: { argb: 'FFFFFFFF' } };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  r2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: themeColor ? 'FF2563EB' : EXCEL_COLORS.indigoAccent }
  };
  ws.getRow(2).height = 24;

  // Row 3: Metadata bar (Period, As of Date, Currency, Accounting Verification)
  ws.mergeCells(`A3:${lastColChar}3`);
  const r3 = ws.getCell('A3');
  const periodText = periodLabel ? `REPORTING PERIOD: ${periodLabel.toUpperCase()}` : '';
  const asOfText = asOfDate ? `AS OF: ${formatDate(asOfDate)}` : `GENERATED: ${formatDate(new Date())}`;
  const tagText = tagline ? `   |   ${tagline}` : '';
  r3.value = `${periodText ? `${periodText}   |   ` : ''}${asOfText}   |   CURRENCY: INR (₹)   |   METHOD: DOUBLE-ENTRY ACCRUAL ACCOUNTING${tagText}`;
  r3.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  r3.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.slateLight }
  };
  ws.getRow(3).height = 22;

  // Row 4: Spacer row
  ws.getRow(4).height = 10;

  return 5; // Column headers start on Row 5
};

/**
 * Formats a table column header row with professional dark slate styling.
 */
export const styleHeaderRow = (
  row: ExcelJS.Row,
  colCount: number,
  bgColor: string = EXCEL_COLORS.navyHeader
) => {
  row.height = 24;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: cell.alignment?.horizontal || 'left',
      wrapText: true
    };
    cell.border = BORDERS.header;
  }
};

/**
 * Formats standard data rows with subtle alternating zebra striping and thin borders.
 */
export const styleDataRow = (
  row: ExcelJS.Row,
  colCount: number,
  isEven: boolean,
  options?: {
    height?: number;
    fontSize?: number;
  }
) => {
  row.height = options?.height || 21;
  const bgColor = isEven ? EXCEL_COLORS.zebraLight : EXCEL_COLORS.zebraWhite;

  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    if (!cell.font) {
      cell.font = { name: 'Calibri', size: options?.fontSize || 10, color: { argb: 'FF1E293B' } };
    }
    if (!cell.fill) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: cell.alignment?.horizontal || 'left'
    };
    cell.border = BORDERS.thin;
  }
};

/**
 * Formats section banner rows (e.g., REVENUE, EXPENSES, ASSETS, LIABILITIES)
 */
export const styleSectionHeaderRow = (
  row: ExcelJS.Row,
  colCount: number,
  title: string,
  bgColor: string = EXCEL_COLORS.indigoSubtle,
  textColor: string = 'FF1E1B4B'
) => {
  row.height = 23;
  row.getCell(1).value = title;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: textColor } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: EXCEL_COLORS.borderMedium } },
      bottom: { style: 'thin', color: { argb: EXCEL_COLORS.borderMedium } }
    };
  }
};

/**
 * Formats grand total / summary rows with double-accounting underline.
 */
export const styleTotalRow = (
  row: ExcelJS.Row,
  colCount: number,
  options?: {
    fillColor?: string;
    textColor?: string;
  }
) => {
  row.height = 25;
  const fill = options?.fillColor || EXCEL_COLORS.totalRowFill;
  const color = options?.textColor || EXCEL_COLORS.navyDark;

  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: color } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: cell.alignment?.horizontal || 'left'
    };
    cell.border = {
      top: { style: 'thin', color: { argb: EXCEL_COLORS.borderMedium } },
      bottom: { style: 'double', color: { argb: EXCEL_COLORS.navyDark } }
    };
  }
};

/**
 * Auto-adjusts column widths to prevent `###` cutoffs and ensure generous readability.
 */
export const autoFitWorksheetColumns = (
  ws: ExcelJS.Worksheet,
  minWidths?: Record<number, number>
) => {
  ws.columns.forEach((column, colIdx) => {
    let maxLength = minWidths?.[colIdx + 1] || 12;

    // Check cells starting from row 5 (ignoring merged title rows 1-3)
    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber <= 4) return;
      const cellValue = cell.value != null ? String(cell.value) : '';
      if (cellValue.length > maxLength) {
        maxLength = Math.min(cellValue.length, 55);
      }
    });

    column.width = Math.max(maxLength + 3, minWidths?.[colIdx + 1] || 12);
  });
};

/**
 * Configures freeze panes (keeping headers visible when scrolling) and enables grid lines.
 */
export const setupSheetViews = (ws: ExcelJS.Worksheet, freezeAtRow: number = 5) => {
  ws.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: freezeAtRow,
      showGridLines: true
    }
  ];

  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9 // A4
  };
};
