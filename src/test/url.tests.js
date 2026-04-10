import { TestRunner } from "./tester";
import Url from "../utils/Url";

export async function runUrlTests(writeOutput) {
	const runner = new TestRunner("URL / SAF URI Tests");

	runner.test(
		"Android external storage: join active location + index.html",
		(test) => {
			const folderUrl =
				"content://com.android.externalstorage.documents/tree/primary%3ATesthtml";
			const activeLocation =
				"content://com.android.externalstorage.documents/tree/primary%3ATesthtml::primary:Testhtml/Styles/";
			const expectedJoined =
				"content://com.android.externalstorage.documents/tree/primary%3ATesthtml::primary:Testhtml/Styles/index.html";

			const joined = Url.join(activeLocation, "index.html");

			test.assertEqual(
				joined,
				expectedJoined,
				"Joined URL should match expected Android SAF file URI",
			);
			test.assert(
				!Url.areSame(folderUrl, joined),
				"Folder URL and joined file URL should not be considered same",
			);
		},
	);

	runner.test("Termux SAF: join active location + index.html", (test) => {
		const folderUrl =
			"content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Facode-site-ui";
		const activeLocation =
			"content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Facode-site-ui::/data/data/com.termux/files/home/acode-site-ui/";
		const expectedJoined =
			"content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Facode-site-ui::/data/data/com.termux/files/home/acode-site-ui/index.html";

		const joined = Url.join(activeLocation, "index.html");

		test.assertEqual(
			joined,
			expectedJoined,
			"Joined URL should match expected Termux SAF file URI",
		);
		test.assert(
			!Url.areSame(folderUrl, joined),
			"Folder URL and joined file URL should not be considered same",
		);
	});

	runner.test(
		"Acode terminal SAF: join active location + index.html",
		(test) => {
			const folderUrl =
				"content://com.foxdebug.acode.documents/tree/%2Fdata%2Fuser%2F0%2Fcom.foxdebug.acode%2Ffiles%2Fpublic";
			const activeLocation =
				"content://com.foxdebug.acode.documents/tree/%2Fdata%2Fuser%2F0%2Fcom.foxdebug.acode%2Ffiles%2Fpublic::/data/user/0/com.foxdebug.acode/files/public/";
			const expectedJoined =
				"content://com.foxdebug.acode.documents/tree/%2Fdata%2Fuser%2F0%2Fcom.foxdebug.acode%2Ffiles%2Fpublic::/data/user/0/com.foxdebug.acode/files/public/index.html";

			const joined = Url.join(activeLocation, "index.html");

			test.assertEqual(
				joined,
				expectedJoined,
				"Joined URL should match expected Acode Terminal SAF file URI",
			);
			test.assert(
				!Url.areSame(folderUrl, joined),
				"Folder URL and joined file URL should not be considered same",
			);
		},
	);

	runner.test(
		"Android SAF folder URL should match with trailing slash",
		(test) => {
			const a =
				"content://com.android.externalstorage.documents/tree/primary%3ATesthtml/";
			const b =
				"content://com.android.externalstorage.documents/tree/primary%3ATesthtml";

			test.assert(
				Url.areSame(a, b),
				"Android folder URLs differing only by trailing slash should be same",
			);
		},
	);

	runner.test(
		"Termux SAF folder URL should match with trailing slash",
		(test) => {
			const a =
				"content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Facode-site-ui/";
			const b =
				"content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome%2Facode-site-ui";

			test.assert(
				Url.areSame(a, b),
				"Termux folder URLs differing only by trailing slash should be same",
			);
		},
	);

	runner.test(
		"Acode terminal SAF folder URL should match with trailing slash",
		(test) => {
			const a =
				"content://com.foxdebug.acode.documents/tree/%2Fdata%2Fuser%2F0%2Fcom.foxdebug.acode%2Ffiles%2Fpublic/";
			const b =
				"content://com.foxdebug.acode.documents/tree/%2Fdata%2Fuser%2F0%2Fcom.foxdebug.acode%2Ffiles%2Fpublic";

			test.assert(
				Url.areSame(a, b),
				"Acode terminal folder URLs differing only by trailing slash should be same",
			);
		},
	);

	runner.test("join should handle leading slash segment", (test) => {
		const activeLocation =
			"content://com.android.externalstorage.documents/tree/primary%3ATesthtml::primary:Testhtml/Styles/";
		const expectedJoined =
			"content://com.android.externalstorage.documents/tree/primary%3ATesthtml::primary:Testhtml/Styles/index.html";

		const joined = Url.join(activeLocation, "/index.html");
		test.assertEqual(
			joined,
			expectedJoined,
			"Leading slash in joined segment should be normalized",
		);
	});

	return await runner.run(writeOutput);
}
