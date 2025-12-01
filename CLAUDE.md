# Transient Notes

## Project Overview

A simple, desktop-focused note-taking application that allows users to create and organize notes with image support. Notes are organized in a dynamic tree structure for flexible organization.

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES2024+)
- **Browser Target**: Chrome (latest version only)
- **Platform**: Desktop only
- **Storage**: IndexedDB for data persistence
- **No external frameworks or libraries** - leverage native browser APIs

## Architecture & Constraints

- **Desktop-only**: No mobile or responsive design required
- **Chrome-only**: Target latest Chrome version, no cross-browser compatibility needed
- **No accessibility requirements**: Focus on core functionality
- **Browser-first approach**: Use native browser APIs whenever possible. Do NOT implement custom solutions for functionality the browser already provides
- **No build tools required**: Pure HTML/CSS/JS that runs directly in the browser

## Coding Conventions

### CSS
- Follow **BEM (Block Element Modifier)** methodology strictly
- Naming pattern: `block__element--modifier`
- Example: `note-editor__toolbar-button--active`

### JavaScript
- **100% functional paradigm** - no classes, no mutations, no side effects in pure functions
- Use pure functions, higher-order functions, composition, and immutability
- Prefer `const` over `let`, never use `var`
- Factor and compose code - avoid duplicating functions
- Example patterns:
  - Function composition: `compose(fn3, fn2, fn1)`
  - Currying: `const add = a => b => a + b`
  - Immutable updates: spread operators, `Object.freeze()`

### Code Organization
- Keep functions small and single-purpose
- Compose complex operations from simple functions
- Extract and reuse common patterns
- Avoid duplication through composition and abstraction

## Key Features

1. **Note Creation**: Simple interface for creating and editing notes
2. **Image Support**:
   - Drag & drop images into notes
   - Copy/paste images from clipboard
3. **Tree Organization**: Dynamic hierarchical structure for organizing notes
4. **Data Persistence**: All data stored in IndexedDB

## Development Guidelines

- **Leverage browser APIs**: Use Drag & Drop API, Clipboard API, IndexedDB API, etc.
- **Don't reinvent the wheel**: If Chrome provides the functionality natively, use it
- **Functional purity**: Keep side effects (DOM manipulation, storage) at the edges
- **Composition over duplication**: Factor common logic into reusable functions

## Important Notes

- IndexedDB operations are asynchronous - handle with Promises or async/await
- Use structured cloning for IndexedDB storage (built-in browser feature)
- Chrome's latest version includes all modern ES2024+ features - use them freely
- For image handling, use `FileReader` API for drag & drop and `ClipboardEvent` for paste
