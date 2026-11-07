import { memo } from 'react';
import PropTypes from 'prop-types';
import './ConfirmDialog.css';

export const ConfirmDialog = memo(({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Export',
  cancelText = 'Cancel',
  isDangerous = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <h2 className="confirm-dialog-title">{title}</h2>
        </div>
        
        <div className="confirm-dialog-content">
          <div className="confirm-dialog-message">
            {message}
          </div>
        </div>
        
        <div className="confirm-dialog-footer">
          <button 
            className="confirm-dialog-btn confirm-dialog-cancel-btn"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`confirm-dialog-btn confirm-dialog-confirm-btn ${isDangerous ? 'dangerous' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
});

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.node.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  isDangerous: PropTypes.bool
};

ConfirmDialog.displayName = 'ConfirmDialog';
