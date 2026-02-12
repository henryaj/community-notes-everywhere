Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    allowed = []
    allowed << "chrome-extension://#{ENV['CHROME_EXTENSION_ID']}" if ENV["CHROME_EXTENSION_ID"].present?
    allowed += ENV["CORS_ORIGINS"].split(",").map(&:strip) if ENV["CORS_ORIGINS"].present?
    allowed += ENV["ALLOWED_ORIGINS"].split(",").map(&:strip) if ENV["ALLOWED_ORIGINS"].present?
    allowed << "http://localhost:3000" if allowed.empty?

    origins(*allowed)

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ["Authorization"]
  end
end
