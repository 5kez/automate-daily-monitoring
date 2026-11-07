import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Export Home view data to PDF with screenshots of each server section
 * @param {Array} servers - Array of server names
 */
export const exportHomeViewToPdf = async (servers) => {
  try {
    // Start with A4 for title page
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const a4PageHeight = pdf.internal.pageSize.getHeight();
    const a4PageWidth = pdf.internal.pageSize.getWidth();

    // Add title page
    pdf.setFontSize(24);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Daily Monitoring Report', a4PageWidth / 2, a4PageHeight / 2, { align: 'center' });
    
    pdf.setFontSize(12);
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    pdf.text(`Generated: ${timestamp}`, a4PageWidth / 2, a4PageHeight / 2 + 20, { align: 'center' });

    // Process each server
    for (const serverName of servers) {
      // Capture entire server container in one go
      const serverContainer = document.getElementById(`server-container-${serverName}`);
      
      if (serverContainer) {
        try {
          // Capture the entire server content with good quality
          const canvas = await html2canvas(serverContainer, {
            scale: 1.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 15000,
            onclone: (clonedDoc) => {
              const clonedElement = clonedDoc.getElementById(`server-container-${serverName}`);
              if (clonedElement) {
                clonedElement.style.overflow = 'visible';
                // Make sure charts are visible
                const charts = clonedElement.querySelectorAll('.recharts-wrapper');
                charts.forEach(chart => {
                  chart.style.maxWidth = '100%';
                  chart.style.overflow = 'visible';
                });
              }
            }
          });

          // Calculate PDF page size from canvas (convert pixels to mm at 96 DPI)
          const pxToMm = 0.264583;
          const pageWidth = canvas.width * pxToMm;
          const pageHeight = canvas.height * pxToMm;
          
          // Add new page with custom size matching content
          pdf.addPage([pageWidth, pageHeight], pageHeight > pageWidth ? 'portrait' : 'landscape');

          const margin = 10;
          const headerHeight = 25;
          
          // Server header
          pdf.setFontSize(18);
          pdf.setTextColor(0, 102, 204);
          pdf.text(serverName, pageWidth / 2, 15, { align: 'center' });

          // Draw separator line
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.5);
          pdf.line(margin, 22, pageWidth - margin, 22);

          // Use JPEG for better compression
          const imgData = canvas.toDataURL('image/jpeg', 0.90);
          
          // Add image at full size (no scaling down)
          const imgWidth = pageWidth - (margin * 2);
          const imgHeight = pageHeight - headerHeight - margin;
          
          pdf.addImage(imgData, 'JPEG', margin, headerHeight, imgWidth, imgHeight);
          
        } catch (err) {
          console.warn(`Error capturing server container ${serverName}:`, err);
        }
      }
    }

    // Add footer with page numbers
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      const currentPageSize = pdf.internal.pageSize;
      const currentPageHeight = currentPageSize.getHeight();
      const currentPageWidth = currentPageSize.getWidth();
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} of ${totalPages}`, currentPageWidth / 2, currentPageHeight - 5, { align: 'center' });
    }

    // Save the PDF
    const fileName = `daily-monitoring-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
    return { success: true, fileName };
  } catch (error) {
    console.error('Error exporting Home PDF:', error);
    throw error;
  }
};

/**
 * Export all server data to a PDF file with actual table screenshots
 * @param {Array} servers - Array of server names
 * @param {Object} serverStates - Object containing server state data
 * @param {Object} tableRefs - References to table DOM elements
 */
export const exportAllServerDataToPdf = async (servers, serverStates, tableRefs = {}) => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    let yPosition = 20;

    // Add title page
    pdf.setFontSize(24);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Auto Monitoring Report', pageWidth / 2, pageHeight / 2, { align: 'center' });
    
    pdf.setFontSize(12);
    const timestamp = new Date().toLocaleString();
    pdf.text(`Generated: ${timestamp}`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
    
    pdf.addPage();
    yPosition = 20;

    // Process each server
    for (const serverName of servers) {
      const serverState = serverStates[serverName];
      
      if (!serverState || serverState.status !== 'ready') {
        continue;
      }

      // Check if need new page for server header
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = 20;
      }

      // Server header
      pdf.setFontSize(16);
      pdf.setTextColor(0, 102, 204);
      pdf.text(`Server: ${serverName}`, margin, yPosition);
      yPosition += 12;

      // Get table refs for this server
      const serverTableRefs = tableRefs[serverName] || {};

      // Stats table
      if (serverTableRefs.statsTable) {
        try {
          const statsCanvas = await html2canvas(serverTableRefs.statsTable, { 
            scale: 2,
            useCORS: true,
            logging: false
          });
          
          const statsImg = statsCanvas.toDataURL('image/png');
          const imgWidth = pageWidth - (margin * 2);
          const imgHeight = (statsCanvas.height / statsCanvas.width) * imgWidth;
          
          if (yPosition + imgHeight > pageHeight - 10) {
            pdf.addPage();
            yPosition = 20;
          }
          
          pdf.addImage(statsImg, 'PNG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 8;
        } catch (err) {
          console.warn('Error capturing stats table:', err);
        }
      }

      // Disk table
      if (serverTableRefs.diskTable) {
        try {
          if (yPosition > pageHeight - 50) {
            pdf.addPage();
            yPosition = 20;
          }
          
          const diskCanvas = await html2canvas(serverTableRefs.diskTable, { 
            scale: 2,
            useCORS: true,
            logging: false
          });
          
          const diskImg = diskCanvas.toDataURL('image/png');
          const imgWidth = pageWidth - (margin * 2);
          const imgHeight = (diskCanvas.height / diskCanvas.width) * imgWidth;
          
          if (yPosition + imgHeight > pageHeight - 10) {
            pdf.addPage();
            yPosition = 20;
          }
          
          pdf.addImage(diskImg, 'PNG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 8;
        } catch (err) {
          console.warn('Error capturing disk table:', err);
        }
      }

      // Tablespace table
      if (serverTableRefs.tablespaceTable) {
        try {
          if (yPosition > pageHeight - 50) {
            pdf.addPage();
            yPosition = 20;
          }
          
          const tsCanvas = await html2canvas(serverTableRefs.tablespaceTable, { 
            scale: 2,
            useCORS: true,
            logging: false
          });
          
          const tsImg = tsCanvas.toDataURL('image/png');
          const imgWidth = pageWidth - (margin * 2);
          const imgHeight = (tsCanvas.height / tsCanvas.width) * imgWidth;
          
          if (yPosition + imgHeight > pageHeight - 10) {
            pdf.addPage();
            yPosition = 20;
          }
          
          pdf.addImage(tsImg, 'PNG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 8;
        } catch (err) {
          console.warn('Error capturing tablespace table:', err);
        }
      }

      yPosition += 10;
    }

    // Add footer with page numbers
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    // Save the PDF
    const fileName = `monitoring-report-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
};
