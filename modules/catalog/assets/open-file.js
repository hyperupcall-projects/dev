;(function () {
	function errorMessage(response, text) {
		try {
			var data = JSON.parse(text)
			return data.error || data.message || text || response.statusText
		} catch (e) {
			return text || response.statusText || 'Could not open file'
		}
	}

	document.querySelectorAll('.open-file').forEach(function (root) {
		var api = root.dataset.api
		var status = root.querySelector('.open-file__status')

		function showError(message) {
			if (!status) {
				return
			}
			status.hidden = false
			status.textContent = message
		}

		function clearError() {
			if (!status) {
				return
			}
			status.hidden = true
			status.textContent = ''
		}

		root.querySelectorAll('.open-file__editor').forEach(function (button) {
			button.addEventListener('click', function () {
				var editor = button.dataset.editor
				var path = button.dataset.path
				if (!api || !editor || !path) {
					showError('Missing editor or file path')
					return
				}

				clearError()
				fetch(api, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ editor: editor, path: path }),
				})
					.then(function (response) {
						return response.text().then(function (text) {
							if (!response.ok) {
								throw new Error(errorMessage(response, text))
							}
							root.removeAttribute('open')
							clearError()
						})
					})
					.catch(function (error) {
						showError(error.message || 'Could not reach local service')
					})
			})
		})
	})
})()
