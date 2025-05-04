import Page from "components/page";
import fsOperation from "fileSystem";
import internalFs from "fileSystem/internalFs";
import Url from "utils/Url";
import helpers from "utils/helpers";
import actionStack from "./actionStack";

export default async function loadPlugin(pluginId, justInstalled = false) {
	const baseUrl = Url.join(PLUGIN_DIR, pluginId);

	console.log("Base url " + baseUrl);

	const cacheFile = Url.join(CACHE_STORAGE, pluginId);

	const pluginJson = await fsOperation(
		Url.join(PLUGIN_DIR, pluginId, "plugin.json"),
	).readFile("json");

	let mainUrl;
	if (
		await fsOperation(Url.join(PLUGIN_DIR, pluginId, pluginJson.main)).exists()
	) {
		mainUrl = Url.join(baseUrl, pluginJson.main);
	} else {
		mainUrl = Url.join(baseUrl, "main.js");
	}

	return new Promise((resolve, reject) => {
		if (pluginId === undefined) {
			console.error("Skipping loading plugin with undefined id");
			reject("Skipping loading plugin with undefined id");
			return;
		}

		const data = internalFs.readStringFile(mainUrl).data;

		const $script = <script dangerouslySetInnerHTML={{ __html: data }} />;

		$script.onerror = (error) => {
			reject(
				new Error(
					`Failed to load script for plugin ${pluginId}: ${error.message || error}`,
				),
			);
		};

		$script.onload = async () => {
			const $page = Page("Plugin");
			$page.show = () => {
				actionStack.push({
					id: pluginId,
					action: $page.hide,
				});

				app.append($page);
			};

			$page.onhide = function () {
				actionStack.remove(pluginId);
			};

			try {
				if (!(await fsOperation(cacheFile).exists())) {
					await fsOperation(CACHE_STORAGE).createFile(pluginId);
				}

				await acode.initPlugin(pluginId, baseUrl, $page, {
					cacheFileUrl: await helpers.toInternalUri(cacheFile),
					cacheFile: fsOperation(cacheFile),
					firstInit: justInstalled,
				});

				resolve();
			} catch (error) {
				reject(error);
			}
		};

		document.head.append($script);
	});
}
