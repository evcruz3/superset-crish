# Superset Plugin Development Guide

This guide outlines the best practices for creating and managing plugins in the Superset frontend monorepo.

## Creating a New Plugin

1. **Initialize Plugin Directory**
```bash
# From the superset-frontend directory
cd plugins
mkdir plugin-chart-your-plugin-name
cd plugin-chart-your-plugin-name

# Initialize the package
npm init -y

# Set the package name following Superset convention
npm pkg set name="@superset-ui/plugin-chart-your-plugin-name"
```

## Plugin Structure

```plaintext
plugin-chart-your-plugin-name/
├── src/
│   ├── index.ts         # Main entry point
│   ├── plugin/
│   │   └── buildQuery.ts
│   │   └── controlPanel.ts
│   │   └── transformProps.ts
│   ├── types/
│   │   └── index.ts
│   └── components/
│       └── YourChart.tsx
├── test/
│   └── index.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Package.json Template

```json
{
  "name": "@superset-ui/plugin-chart-your-plugin-name",
  "version": "0.1.0",
  "description": "Superset Chart - Your Plugin Description",
  "sideEffects": false,
  "main": "lib/index.js",
  "module": "esm/index.js",
  "files": [
    "esm",
    "lib"
  ],
  "scripts": {
    "build": "npm run build-cjs && npm run build-esm",
    "build-cjs": "tsc -p tsconfig.json",
    "build-esm": "tsc -p tsconfig.esm.json",
    "test": "jest"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/apache/superset.git",
    "directory": "superset-frontend/plugins/plugin-chart-your-plugin-name"
  },
  "keywords": [
    "superset"
  ],
  "author": "Your Name",
  "license": "Apache-2.0",
  "publishConfig": {
    "access": "public"
  }
}
```

## Dependency Management

### Adding Dependencies

```bash
# Add a runtime dependency
npm install --save exact-version-number dependency-name

# Add a peer dependency (for shared dependencies)
npm install --save-peer exact-version-number @superset-ui/core

# Add a dev dependency
npm install --save-dev exact-version-number typescript
```

### Core Dependencies Setup

Always include these as peer dependencies:
```json
{
  "peerDependencies": {
    "@superset-ui/core": "*",
    "@superset-ui/chart-controls": "*",
    "react": "^16.13.1",
    "react-dom": "^16.13.1"
  }
}
```

### Version Matching

```bash
# Check version in main package.json
cat ../package.json | grep "@superset-ui/core"

# Install matching version
npm install --save-peer @superset-ui/core@"version-number"
```

## Linking Your Plugin

```bash
# From your plugin directory
npm link

# From superset-frontend directory
npm link @superset-ui/plugin-chart-your-plugin-name
```

## Best Practices for Dependency Management

1. **Version Control**
   - Always use exact versions (`"dependency": "1.2.3"` not `"^1.2.3"`)
   - Keep dependencies minimal
   - Prefer peer dependencies for shared libraries
   - Match versions with main superset-frontend
   - Document all peer dependencies

2. **Installation Flags**
   ```bash
   # Use --save-exact for exact versions
   npm install --save-exact dependency-name
   
   # Use --save-peer for shared dependencies
   npm install --save-peer @superset-ui/core
   ```

## Avoiding Dependency Hell

1. **Regular Maintenance**
```bash
# Check dependency tree
npm ls

# Remove unused dependencies
npm prune

# Check for and remove duplicate dependencies
npm dedupe

# Clean install
rm -rf node_modules package-lock.json
npm install
```

2. **Dependency Auditing**
```bash
# Check for security issues
npm audit

# Update dependencies
npm update
```

## Testing Setup

1. **Install Test Dependencies**
```bash
npm install --save-dev jest @types/jest @testing-library/react
```

2. **Run Tests**
```bash
npm test
```

## Integration with Main Project

Add your plugin to the main `superset-frontend/package.json`:
```json
{
  "dependencies": {
    "@superset-ui/plugin-chart-your-plugin-name": "file:./plugins/plugin-chart-your-plugin-name"
  }
}
```

## Common Issues and Solutions

1. **Multiple React Versions**
   - Ensure React is a peer dependency
   - Use the same version as the main project
   - Check for duplicate React installations

2. **Build Issues**
   - Ensure all necessary build dependencies are installed
   - Check TypeScript configuration
   - Verify build scripts in package.json

3. **Version Conflicts**
   - Use `npm ls package-name` to check versions
   - Ensure peer dependencies match main project
   - Use exact versions to prevent drift

## Development Workflow

1. **Initial Setup**
```bash
cd superset-frontend/plugins
mkdir plugin-chart-your-plugin-name
cd plugin-chart-your-plugin-name
npm init -y
```

2. **Development Cycle**
```bash
# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Build
npm run build
```

3. **Integration Testing**
```bash
# Link plugin
npm link

# In superset-frontend
npm link @superset-ui/plugin-chart-your-plugin-name

# Start development server
npm run dev-server
```

## Plugin Registration

In your plugin's `src/index.ts`:
```typescript
import { ChartPlugin } from '@superset-ui/core';
import buildQuery from './plugin/buildQuery';
import controlPanel from './plugin/controlPanel';
import transformProps from './plugin/transformProps';
import thumbnail from './images/thumbnail.png';

export default class YourChartPlugin extends ChartPlugin {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./components/YourChart'),
      metadata: {
        description: 'Your chart description',
        name: 'Your Chart',
        thumbnail,
      },
      transformProps,
    });
  }
}
```

## Debugging Tips

1. **Development Tools**
   - Use React Developer Tools
   - Enable source maps in webpack configuration
   - Use browser console for debugging

2. **Common Debug Points**
   - Check plugin registration
   - Verify data transformations
   - Monitor network requests
   - Inspect component props

## Production Considerations

1. **Build Optimization**
   - Minimize bundle size
   - Remove development dependencies
   - Optimize assets

2. **Performance**
   - Use React.memo for pure components
   - Implement proper memoization
   - Optimize re-renders

## Additional Resources

- [Superset Documentation](https://superset.apache.org/docs/installation/building-custom-viz-plugins)
- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)