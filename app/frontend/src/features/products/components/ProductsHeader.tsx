import React from 'react';
import { Layers, Database, Globe } from 'lucide-react';

export const ProductsHeader: React.FC = () => {
  return (
    <header
      style={{
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Layers size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              SE310 Project Manager
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Next.js 16 + ASP.NET Core 10 (Clean Architecture)
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: '0.85rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              backgroundColor: '#f1f5f9',
              borderRadius: 20,
              color: 'var(--text-secondary)',
            }}
          >
            <Globe size={16} color="#2563eb" />
            <span>
              Frontend: <strong>Port 3000</strong>
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              backgroundColor: '#f1f5f9',
              borderRadius: 20,
              color: 'var(--text-secondary)',
            }}
          >
            <Database size={16} color="#16a34a" />
            <span>
              Backend API: <strong>Port 5290</strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
