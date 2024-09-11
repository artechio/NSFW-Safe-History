# NSFW Safe History Extension

This extension for Chrome and Edge helps you manage and remove NSFW (Not Safe For Work) history from your browser. It provides options to automatically delete flagged pages and allows you to add keywords either from a file or one by one.

## Features

- **Automatic Deletion**: Automatically delete flagged pages from your browsing history.
- **Keyword Management**: Add, modify, or remove keywords that trigger the deletion of history entries.
  - **File Upload**: Upload a text file containing keywords.
  - **Manual Entry**: Add keywords one by one through the UI.

## Installation

To install and experiment with this extension, follow these steps:

1. Clone this repository:
    ```sh
    git clone https://github.com/artechio/NSFW-Safe-History.git
    ```
2. Open Chrome or Edge and navigate to the Extensions page (`chrome://extensions/` or `edge://extensions/`).
3. Enable "Developer mode" using the toggle switch in the top right corner.
4. Click on "Load unpacked" and select the directory where you cloned the repository.

## Usage

1. Open the extension's options page.
2. Toggle the "Automatically delete flagged pages from history" option to enable or disable automatic deletion.
3. Add keywords:
   - **From a file**: Use the file input to upload a text file containing keywords.
   - **Manually**: Enter keywords one by one using the input field and click "Add".

## Contributing

We welcome contributions! Please see the CONTRIBUTING.md file for guidelines on how to contribute to this project.

## License

This project is licensed under the Apache License, Version 2.0.
