import * as vscode from "vscode";
import sizeOf from "image-size";
import OpenAI from "openai";
import fs from "fs";
const bytes = require("bytes");

const openai = new OpenAI({ apiKey: "YOUR_API_KEY_HERE" });

function convertToBase64(path: fs.PathLike): string {
	return fs.readFileSync(path, { encoding: "base64" });
}

async function GenerateAltText() {
	if (vscode.window.activeTextEditor) {
		const editor = vscode.window.activeTextEditor;

		if (editor.selection.isEmpty) {
			vscode.window.showErrorMessage("There's no image src selection");
			return;
		}

		const imageSrc = editor.document.getText(editor.selection);

		if (!vscode.workspace.workspaceFolders) {
			throw new Error("Pasta do projeto não encontrada.");
		}

		const rootUri = vscode.workspace.workspaceFolders[0].uri;
		const fileUri = vscode.Uri.file(`${rootUri.fsPath}/${imageSrc}`);
		console.log("path: ", fileUri.fsPath);

		const stat = await vscode.workspace.fs.stat(fileUri);
		const dimensions = sizeOf(fileUri.fsPath);

		console.log("Size: ", bytes(stat.size));
		console.log("Type: ", dimensions.type); // We currently support PNG (.png), JPEG (.jpeg and .jpg), WEBP (.webp), and non-animated GIF (.gif).
		console.log(`Dimensions: ${dimensions.width}x${dimensions.height}`);

		const base64 = convertToBase64(fileUri.fsPath);

		const response = await openai.chat.completions.create({
			model: "gpt-4-vision-preview",
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Gere uma descrição adequada da imagem para uso no texto alternativo, seguindo as recomendações de acessibilidade para um site. Resuma a descrição para que tenha no máximo 150 caracteres.",
						},
						{
							type: "image_url",
							image_url: {
								url: `data:image/${dimensions.type};base64,${base64}`,
								detail: "low",
							},
						},
					],
				},
			],
			max_tokens: 150,
		});

		console.log(response);

		if (response.choices[0].message.content) {
			vscode.env.clipboard.writeText(response.choices[0].message.content);
			vscode.window.showInformationMessage(`The alt text was generated and copied.`);
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand("alt-text-with-gpt-vision.GenerateAltText", GenerateAltText));
}

export function deactivate() {}

