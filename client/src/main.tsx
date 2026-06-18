import "./lib/polyfills"; // must be first — defines Buffer/global for web3 + spl-token
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import WalletBridge from "./lib/WalletBridge";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletBridge>
        <App />
      </WalletBridge>
    </BrowserRouter>
  </React.StrictMode>,
);
