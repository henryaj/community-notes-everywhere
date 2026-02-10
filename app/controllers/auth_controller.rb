class AuthController < ApplicationController
  # GET /auth/x/callback
  def callback
    auth = request.env["omniauth.auth"]
    user = User.find_or_create_from_oauth(auth)

    # Render a page that sends the token back to the Chrome extension
    render html: <<~HTML.html_safe
      <!DOCTYPE html>
      <html>
      <head><title>Login Successful</title></head>
      <body>
        <h1>Login successful!</h1>
        <p>You can close this tab. Sending credentials to extension...</p>
        <script>
          // Send token to the Chrome extension
          if (chrome && chrome.runtime) {
            chrome.runtime.sendMessage(
              document.getElementById('ext-id')?.value,
              {
                type: 'AUTH_TOKEN',
                token: '#{user.auth_token}',
                user: {
                  handle: '#{user.twitter_handle}',
                  displayName: '#{user.display_name}',
                  avatarUrl: '#{user.avatar_url}'
                }
              }
            );
          }
          // Also try postMessage for popup-based flows
          window.opener?.postMessage({
            type: 'AUTH_TOKEN',
            token: '#{user.auth_token}'
          }, '*');
          setTimeout(() => window.close(), 2000);
        </script>
      </body>
      </html>
    HTML
  end

  # Handle OmniAuth failure
  def failure
    render json: { error: "Authentication failed", reason: params[:message] }, status: :unauthorized
  end
end
