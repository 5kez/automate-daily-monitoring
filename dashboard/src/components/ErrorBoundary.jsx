// Component: ErrorBoundary.jsx
// Catches React errors and displays fallback UI
// Prevents entire app from crashing due to component errors

import { Component } from 'react';
import PropTypes from 'prop-types';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // Always log errors from ErrorBoundary as they're critical
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: '#0d1117',
            border: '1px solid #f85149',
            borderRadius: '8px',
            padding: '30px',
            margin: '20px',
            textAlign: 'center',
            color: '#ffffff'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '12px',
              color: '#f85149'
            }}
          >
            Oops! Something went wrong
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#FFFFFF',
              marginBottom: '20px',
              maxWidth: '600px',
              margin: '0 auto 20px'
            }}
          >
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details
              style={{
                marginTop: '20px',
                textAlign: 'left',
                background: '#161b22',
                padding: '15px',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#FFFFFF',
                maxWidth: '800px',
                margin: '20px auto',
                overflow: 'auto'
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: '600',
                  marginBottom: '10px',
                  color: '#ffffff'
                }}
              >
                Error Details (Development)
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            style={{
              background: 'linear-gradient(135deg, #238636 0%, #1a7f37 100%)',
              border: '1px solid #2ea043',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '20px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(35, 134, 54, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #2ea043 0%, #1f6835 100%)';
              e.target.style.boxShadow = '0 6px 16px rgba(35, 134, 54, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #238636 0%, #1a7f37 100%)';
              e.target.style.boxShadow = '0 4px 12px rgba(35, 134, 54, 0.2)';
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#30363d',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '20px',
              marginLeft: '10px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = '#3d444d'}
            onMouseLeave={(e) => e.target.style.background = '#30363d'}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  onReset: PropTypes.func,
  children: PropTypes.node.isRequired
};
