Rails.application.config.middleware.use OmniAuth::Builder do
  provider :twitter2,
    ENV.fetch("TWITTER_CLIENT_ID", ""),
    ENV.fetch("TWITTER_CLIENT_SECRET", ""),
    path_prefix: "/auth",
    name: "x",
    callback_path: "/auth/x/callback",
    scope: "tweet.read users.read"
end

OmniAuth.config.allowed_request_methods = [ :get, :post ]
OmniAuth.config.silence_get_warning = true
