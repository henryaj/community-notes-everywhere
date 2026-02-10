Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(
      "chrome-extension://#{ENV.fetch('CHROME_EXTENSION_ID', '*')}",
      *ENV.fetch("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    )

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ["Authorization"]
  end
end
