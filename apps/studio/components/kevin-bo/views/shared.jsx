// Shell mark for the live partner portal. The diagnostic factory keeps its own copy.
import React from 'react';

const h = React.createElement;

export function Mark({ size = 22 }) {
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 100 100',
    style: { display: 'block', flex: 'none' },
  }, h('path', {
    d: 'M8 22V8H22M78 8H92V22M92 78V92H78M22 92H8V78',
    stroke: '#0A0B0D',
    strokeWidth: '8',
    fill: 'none',
    strokeLinecap: 'square',
  }), h('path', {
    d: 'M68 36C68 28 60 24 50 24C40 24 32 28 32 36C32 50 68 50 68 64C68 72 60 76 50 76C40 76 32 72 32 64',
    stroke: '#0A0B0D',
    strokeWidth: '9.5',
    fill: 'none',
    strokeLinecap: 'square',
  }));
}
