// src/pages/UploadSQL.jsx
import React, { useState, useEffect, useRef } from "react";
import pako from "pako";

// ------------------ Syntax Highlight Helper ------------------
const syntaxHighlight = (json) => {
  if (typeof json !== "string") {
    json = JSON.stringify(json, null, 2); // Pretty print JSON
  }
  json = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return json.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "text-green-400";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-blue-400 font-semibold";
        }
      } else if (/true|false/.test(match)) {
        cls = "text-yellow-400 font-bold";
      } else if (/null/.test(match)) {
        cls = "text-gray-400 italic";
      } else {
        cls = "text-purple-400";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
};

// ------------------ PlantUML Encoder ------------------
function plantUmlEncode(text) {
  // Correct UTF-8 encoding
  const utf8 = new TextEncoder().encode(text);

  // Raw deflate without zlib headers
  const deflated = pako.deflate(utf8, { level: 9, raw: true });

  const charSet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
  let encoded = "";
  let curr = 0;
  let val = 0;

  for (let i = 0; i < deflated.length; i++) {
    val = (val << 8) | deflated[i];
    curr += 8;
    while (curr >= 6) {
      curr -= 6;
      encoded += charSet[(val >> curr) & 0x3F];
    }
  }
  if (curr > 0) {
    encoded += charSet[(val << (6 - curr)) & 0x3F];
  }
  return encoded;
}


const normalizeName = (name) => (name || "").replace(/`/g, "").trim();

const generatePlantUMLER = (data) => {
  let diagram = `
@startuml
skinparam backgroundColor #1e1e2f
skinparam classFontColor white
skinparam classAttributeFontColor #b0b0b0
skinparam classAttributeIconSize 0
skinparam classBackgroundColor #1e1e2f
skinparam classBorderColor white
skinparam arrowColor white
skinparam ArrowFontColor white
skinparam classFontSize 18
skinparam dpi 150
`;


  // Tables
  for (const tableName in data.tables) {
    const cleanName = normalizeName(tableName);
    diagram += `class ${cleanName} {\n`;
    data.tables[tableName].forEach((col) => {
      const pkFlag = col.isPK ? " PK" : "";
      const fkFlag = col.isFK ? " FK" : "";
      diagram += `  ${col.type} ${col.name}${pkFlag}${fkFlag}\n`;
    });
    diagram += `}\n`;
  }

  // Relationships
  if (Array.isArray(data.relationships)) {
    data.relationships.forEach((rel) => {
      const from = normalizeName(rel.from);
      const to = normalizeName(rel.to);

      // Ensure no self-loop and valid names
      if (from && to && from !== to) {
        // Assuming 'from' is PK side in parseSQLFile
        diagram += `${from} "1" -- "many" ${to} : ${rel.name || ""}\n`;
      }
    });
  }

  diagram += `@enduml`;
  return diagram;
};

export default function UploadSQL() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [diagramUrl, setDiagramUrl] = useState("");
  const fileInputRef = useRef(null);

  // Floating SQL keywords
  const [floatingKeywords, setFloatingKeywords] = useState([]);
  const sqlKeywords = [
    "SELECT", "FROM", "WHERE", "JOIN", "ON", "INSERT", "UPDATE", "DELETE",
    "CREATE", "DROP", "ALTER", "INDEX", "PRIMARY KEY", "FOREIGN KEY", "VALUES",
    "GROUP BY", "ORDER BY", "HAVING", "UNION", "DISTINCT"
  ];

  useEffect(() => {
    setFloatingKeywords(Array.from({ length: 30 }).map(() => {
      const word = sqlKeywords[Math.floor(Math.random() * sqlKeywords.length)];
      const sizes = ["text-lg", "text-2xl", "text-4xl"];
      const sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
      const opacity = (Math.random() * 0.3 + 0.1).toFixed(2);
      const top = `${Math.random() * 100}%`;
      const left = `${Math.random() * 100}%`;
      const animationDuration = `${5 + Math.random() * 5}s`;
      const animationDelay = `${Math.random() * 5}s`;
      return { word, sizeClass, opacity, top, left, animationDuration, animationDelay };
    }));
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
    setDiagramUrl("");
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setDiagramUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setDiagramUrl("");

    const formData = new FormData();
    formData.append("sqlFile", file);

    try {
      const res = await fetch("http://localhost:3000/api/normalize/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);

      // Generate PlantUML diagram
      const plantText = generatePlantUMLER(data);
      const encoded = plantUmlEncode(plantText);
      const imgUrl = `https://www.plantuml.com/plantuml/png/${encoded}`;
      setDiagramUrl(imgUrl);
    } catch (err) {
      console.error(err);
      alert("Error uploading SQL file");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!diagramUrl) return;
    try {
      const res = await fetch(diagramUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ER_Diagram.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  return (
    <div className="relative bg-gray-50 min-h-screen w-full p-6 overflow-hidden">
      {floatingKeywords.map((item, i) => (
        <span
          key={i}
          className={`absolute text-purple-600 font-extrabold ${item.sizeClass}`}
          style={{
            top: item.top,
            left: item.left,
            opacity: item.opacity,
            animationDuration: item.animationDuration,
            animationDelay: item.animationDelay,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
            animationName: "float",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        >
          {item.word}
        </span>
      ))}

      <div className="max-w-4xl mx-auto mt-16 relative z-10">
        <h2 className="text-3xl font-bold mb-6 text-purple-700">Upload SQL Dump</h2>

        <div className="bg-white shadow-lg rounded-lg p-6 flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".sql"
            onChange={handleFileChange}
            className="flex-grow text-sm text-gray-700
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-purple-600 file:text-white
                       hover:file:bg-purple-700"
            disabled={uploading}
          />
          {file && (
            <button
              onClick={clearFile}
              className="text-red-600 hover:text-red-800 font-bold text-xl px-2 rounded"
              title="Clear selected file"
              aria-label="Clear selected file"
              type="button"
            >
              &times;
            </button>
          )}
        </div>

        <button
          onClick={handleUpload}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={uploading || !file}
        >
          {uploading ? "Uploading..." : "Upload & Parse"}
        </button>

        {result && (
          <div className="mt-8 bg-gray-50 p-6 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-800">Parsed Tables:</h3>
            <div className="overflow-auto max-h-64 mt-4 bg-gray-900 p-4 rounded shadow">
              <pre
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(result) }}
              ></pre>
            </div>

            {diagramUrl && (
              <div className="mt-6 p-6 border-2 border-dashed rounded-lg bg-gray-900 shadow text-white">
                <h4 className="font-medium mb-4 text-white">ER Diagram (PlantUML)</h4>
                <img src={diagramUrl} alt="ER Diagram" style={{ maxWidth: "100%" }} />
                <button
                  onClick={handleDownload}
                  className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Download Diagram
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-25px) translateX(15px); }
          100% { transform: translateY(0) translateX(0); }
        }
      `}</style>
    </div>
  );
}
