# 🚀 Worker CMS: A Cloudflare Headless CMS

Worker CMS is a minimal, yet powerful, headless Content Management System designed to run seamlessly on [Cloudflare Workers](https://workers.cloudflare.com/), leveraging the global Cloudflare network for speed and scalability. It's built to be effortlessly self-hosted, offering a free tier-friendly solution for managing your content.

🔗 **[Live demo (read-only) here!](https://cms-worker.shaw-hunter-a.workers.dev/)**

## ✨ Features

Worker CMS provides a comprehensive suite of tools for content management, all running on the edge:

*   👤 **User Management**:
    *   Secure passwordless authentication.
    *   API token support for programmatic access.
    *   Email verification via [Resend](https://resend.com/) (with console log fallback for development).
*   🧱 **Data Modeling with JSON Schema**:
    *   Define your content structures using the flexible [JSON Schema](https://json-schema.org/) standard.
    *   Data is stored reliably in [Cloudflare D1](https://www.cloudflare.com/developer-platform/products/d1/), Cloudflare's native serverless SQL database.
*   🗂️ **File Storage**:
    *   Integrated file management for hosting images, documents, and other assets.
    *   Utilizes [Cloudflare R2](https://www.cloudflare.com/developer-platform/products/r2/) for scalable and cost-effective object storage.
*   ✍️ **Rich Markdown Editor**:
    *   Intuitive content creation with the [MDX Editor](https://mdxeditor.dev/), supporting common formatting, links, and image uploads directly to R2.
*   👀 **Live Preview**:
    *   Instantly preview your content changes within your own websites or applications via an iframe and `window.postMessage` communication.
*   🔌 **Extensible Plugin System**:
    *   Tailor the CMS to your exact needs by creating or integrating plugins.
    *   Plugins can:
        *   Add new data models and associated UI in the admin panel.
        *   Introduce custom server-side routes and middleware.
        *   Integrate with third-party services and APIs.
*   🛍️ **Example: BigCommerce Plugin Included**:
    *   Demonstrates the power of the plugin system.
    *   Allows Worker CMS to be installed as an app within a BigCommerce store.
    *   Handles OAuth2 installation and token management.
    *   Adds BigCommerce-specific models (e.g., Products, Configuration) to the CMS.
    *   Provides a foundation for syncing and managing BigCommerce data through Worker CMS.

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended) and npm.
*   A [Cloudflare account](https://dash.cloudflare.com/sign-up).

### Setup

1.  **Clone or Download**:
    Get the project code:
    ```bash
    git clone https://github.com/your-username/cms-worker.git # Or download the ZIP
    cd cms-worker
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Database Migration**:
    Set up your Cloudflare D1 database tables. You'll need `wrangler` logged in (`npx wrangler login`).
    ```bash
    npx wrangler d1 migrations apply YOUR_DATABASE_NAME --local # For local development
    # or
    # npx wrangler d1 migrations apply YOUR_DATABASE_NAME --remote # For production
    ```
    *Ensure your `wrangler.toml` has the correct D1 binding and database ID.*

4.  **Local Development**:
    Start the development server (usually on `http://localhost:3000`):
    ```bash
    npm start
    ```
    During local development, user verification codes will be printed to the console if a Resend API key is not configured.

## 🛠️ Configuration & Development

### Core Configuration (`wrangler.toml`)

Your `wrangler.toml` file is crucial for binding Cloudflare services:

*   **D1 Database**: For storing content and user data.
*   **R2 Bucket**: For file storage.
*   **Environment Variables**:
    *   `RESEND_KEY`: (Optional) Your API key from Resend for sending verification emails.
    *   `DEMO`: Set to `"true"` to enable read-only demo mode.
    *   `JWT_SECRET`: A strong secret for signing JWTs (used by core auth).
    *   For the BigCommerce Plugin:
        *   `BIGCOMMERCE_CLIENT_ID`: Your BigCommerce app's Client ID.
        *   `BIGCOMMERCE_CLIENT_SECRET`: Your BigCommerce app's Client Secret.

### Defining Data (Models)

*   Models are defined using JSON Schema. Core models can be structured in `src/models.ts` (or a similar configuration file).
*   Plugins, like the included BigCommerce plugin (`src/plugins/big-commerce/app.tsx`), can dynamically register their own models with the CMS.
*   **Schema Rules**:
    *   The root `schema` must be an `object`.
    *   Supported property types: `string`, `number`, `boolean`, `array`, `object`.
    *   Properties can have `title`, `description`, and `default` values.
    *   Strings can have `format: 'date-time'` or `format: 'markdown'`.
    *   Arrays typically use `items: { type: 'object', properties: { ... } }` or `items: { anyOf: [...] }` for polymorphic arrays (block-style content).

### Markdown Editor

String properties with `format: 'markdown'` utilize the MDX Editor, offering a rich text editing experience with support for headings, lists, emphasis, links, and image uploads.

### Live Preview

Models can enable live preview by defining a `previewURL` function in their configuration:
`previewURL?: (document: { model: string; name: string; value: any }) => string | undefined;`
This function should return the URL to load in an iframe. The CMS will `postMessage` updates to this iframe as the document changes. See `public/test.html` for a basic JavaScript example.

### Building Plugins

Plugins are the primary way to extend Worker CMS. A typical plugin might have:

*   **Server-Side Logic (`server.ts` or similar)**:
    *   Located within a plugin directory (e.g., `src/plugins/my-plugin/server.ts`).
    *   Can add new routes to the main worker router (`import { router } from '../../worker'`).
    *   Can add custom middleware.
    *   Example: `src/plugins/big-commerce/server.ts` handles BigCommerce installation and API authentication.
*   **Client-Side Logic (`app.tsx` or similar)**:
    *   Located within a plugin directory (e.g., `src/plugins/my-plugin/app.tsx`).
    *   Can register new models with the CMS frontend.
    *   Can provide custom editor components or UI elements.
    *   Example: `src/plugins/big-commerce/app.tsx` registers product and configuration models.

### Key Development Files

*   **Backend Entry**: `src/worker.ts` (main Cloudflare Worker script).
*   **Frontend Core**: `src/components/app.tsx` (main React application).
*   **Models Configuration**: Typically `src/models.ts` for core models.
*   **Plugin Directory**: `src/plugins/` for individual plugin modules.

## ☁️ Deployment

1.  **Configure `wrangler.toml`**:
    Ensure all necessary bindings (D1, R2) and environment variables (see "Core Configuration") are set for your production environment.

2.  **Deploy to Cloudflare**:
    ```bash
    npm run deploy
    ```

This will publish your Worker CMS instance to your Cloudflare account, making it accessible via the configured routes.
