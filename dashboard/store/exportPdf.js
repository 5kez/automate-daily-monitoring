import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportAllServerDataToPdf = async (servers, serverStates, tableRefs = {}) => {
  if (!servers || servers.length === 0) {
    throw new Error('No servers to export');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;
  let pageNumber = 1;

  // Add title
  const titleText = `Daily Monitor Report - ${new Date().toLocaleString()}`;
  doc.setFontSize(16);
  doc.text(titleText, margin, currentY);
  currentY += 15;

  // Process each server
  for (const serverName of servers) {
    const serverState = serverStates?.[serverName];
    if (!serverState || serverState.status !== 'ready') {
      continue;
    }

    // Add page break if needed
    if (currentY > pageHeight - 50) {
      doc.addPage();
      pageNumber++;
      currentY = margin;
    }

    // Add server name header
    doc.setFontSize(14);
    doc.setTextColor(0, 120, 215); // Blue for server name
    doc.text(`Server: ${serverName}`, margin, currentY);
    currentY += 10;
    doc.setTextColor(0, 0, 0); // Reset to black

    // Try to capture and embed stats table
    if (tableRefs?.[serverName]?.statsTable) {
      try {
        const statsElement = tableRefs[serverName].statsTable;
        if (statsElement && statsElement.offsetHeight > 0) {
          const canvas = await html2canvas(statsElement, {
            scale: 1,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.75);
          const imgHeight = (canvas.height * contentWidth) / canvas.width;
          
          // Check if image fits on current page
          if (currentY + imgHeight > pageHeight - margin) {
            doc.addPage();
            pageNumber++;
            currentY = margin;
          }
          
          doc.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
          currentY += imgHeight + 5;
        }
      } catch (error) {
        console.warn(`Failed to capture stats table for ${serverName}:`, error);
      }
    }

    // Try to capture and embed disk table
    if (tableRefs?.[serverName]?.diskTable) {
      try {
        const diskElement = tableRefs[serverName].diskTable;
        if (diskElement && diskElement.offsetHeight > 0) {
          const canvas = await html2canvas(diskElement, {
            scale: 1,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.75);
          const imgHeight = (canvas.height * contentWidth) / canvas.width;
          
          // Check if image fits on current page
          if (currentY + imgHeight > pageHeight - margin) {
            doc.addPage();
            pageNumber++;
            currentY = margin;
          }
          
          doc.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
          currentY += imgHeight + 5;
        }
      } catch (error) {
        console.warn(`Failed to capture disk table for ${serverName}:`, error);
      }
    }

    // Try to capture and embed tablespace table
    if (tableRefs?.[serverName]?.tablespaceTable) {
      try {
        const tablespaceElement = tableRefs[serverName].tablespaceTable;
        if (tablespaceElement && tablespaceElement.offsetHeight > 0) {
          const canvas = await html2canvas(tablespaceElement, {
            scale: 1,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.75);
          const imgHeight = (canvas.height * contentWidth) / canvas.width;
          
          // Check if image fits on current page
          if (currentY + imgHeight > pageHeight - margin) {
            doc.addPage();
            pageNumber++;
            currentY = margin;
          }
          
          doc.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
          currentY += imgHeight + 5;
        }
      } catch (error) {
        console.warn(`Failed to capture tablespace table for ${serverName}:`, error);
      }
    }

    // Add some spacing between servers
    currentY += 5;
  }

  // Save the PDF
  const fileName = `Daily_Monitor_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
