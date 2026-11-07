// Component: Toast.jsx
// Toast notification system for user feedback
// Supports success, error, warning, and info messages

import { createContext, useContext, useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const Toast = memo(({ message, type, onClose }) => {
  const colors = {
    success: { bg: '#238636', border: '#2ea043', icon: '✓' },
    error: { bg: '#da3633', border: '#f85149', icon: '✕' },
    warning: { bg: '#d29922', border: '#f0883e', icon: '⚠' },
    info: { bg: '#1f6feb', border: '#58a6ff', icon: 'ℹ' }
  };

  const color = colors[type] || colors.info;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: color.bg,
        border: `1px solid ${color.border}`,
        borderRadius: '8px',
        padding: '14px 20px',
        maxWidth: '400px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 9999,
        animation: 'slideIn 0.3s ease-out',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '500'
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `}</style>
      <span style={{ fontSize: '18px', fontWeight: '700' }}>{color.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '18px',
          padding: '0',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.8,
          transition: 'opacity 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '1'}
        onMouseLeave={(e) => e.target.style.opacity = '0.8'}
      >
        ×
      </button>
    </div>
  );
});

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired,
  onClose: PropTypes.func.isRequired
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const toast = useCallback({
    success: (message, duration) => showToast(message, 'success', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    warning: (message, duration) => showToast(message, 'warning', duration),
    info: (message, duration) => showToast(message, 'info', duration),
    hide: hideToast
  }, [showToast, hideToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toasts.map(({ id, message, type }) => (
        <Toast
          key={id}
          message={message}
          type={type}
          onClose={() => hideToast(id)}
        />
      ))}
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired
};
