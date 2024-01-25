import * as vscode from "vscode";
import sizeOf from "image-size";
import OpenAI from "openai";
import fs from "fs";
const bytes = require("bytes");

function checkApiKeyFormat(key: string): boolean {
	const regex = new RegExp(/^sk-[a-zA-Z0-9]{32,}$/);
	return regex.test(key);
}

function convertToBase64(path: fs.PathLike): string {
	return fs.readFileSync(path, { encoding: "base64" });
}

async function GenerateAltText() {
	const { apiKey, chat } = vscode.workspace.getConfiguration("alt-text-with-gpt-vision");

	if (!checkApiKeyFormat(apiKey)) {
		vscode.window.showErrorMessage("The API key format is invalid, make sure you provide a [valid key](https://platform.openai.com/api-keys).");
		return;
	}

	const openai = new OpenAI({ apiKey });

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
			model: chat.model,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: chat.prompt,
						},
						{
							type: "image_url",
							image_url: {
								url: `data:image/${dimensions.type};base64,${base64}`,
								detail: chat.detail,
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

