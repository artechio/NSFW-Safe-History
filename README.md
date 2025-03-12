# NSFW Safe History Chrome Extension

A Chrome extension that helps protect your browsing history by automatically detecting and filtering NSFW content. The extension uses a combination of domain-based filtering and image processing to ensure a safer browsing experience.

## Features

- 🔒 Automatic NSFW content detection and filtering
- 🖼️ Image blurring with click-to-reveal functionality
- 📝 Customizable keyword filtering
- 🗑️ Automatic history cleaning for NSFW content
- ⚙️ Customizable settings and preferences
- 🔄 Regular updates to the NSFW domain blocklist
- 🎯 Site-specific filtering options

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nsfw-safe-history.git
cd nsfw-safe-history
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder

### From Chrome Web Store

*(Coming soon)*

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Chrome browser

### Project Structure

```
nsfw-safe-history/
├── src/
│   ├── background.js    # Background service worker
│   ├── contentScript.js # Content script for page processing
│   ├── popup.js        # Popup UI logic
│   └── options.js      # Options page logic
├── assets/             # Static assets (images, CSS)
├── public/             # HTML files
├── dist/              # Built extension
└── manifest.json      # Extension manifest
```

### Building

```bash
# Development build
npm run dev

# Production build
npm run build
```

### Testing

1. Load the extension in Chrome
2. Visit a test website
3. Check the console for any errors
4. Verify that images are properly blurred
5. Test the history cleaning functionality

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- NSFW domain list from [columndeeply/hosts](https://github.com/columndeeply/hosts)
- Icons from [Heroicons](https://heroicons.com/)
- UI components inspired by modern design patterns

## Support

If you encounter any issues or have suggestions, please open an issue in the GitHub repository.
