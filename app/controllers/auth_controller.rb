class AuthController < ActionController::Base
  # GET /auth/x/callback — real OAuth
  def callback
    auth = request.env["omniauth.auth"]
    user = User.find_or_create_from_oauth(auth)
    redirect_to_extension(user)
  end

  # GET /auth/dev/pick — dev-only user picker
  def dev_pick
    raise ActionController::RoutingError, "Not Found" unless Rails.env.development?

    users = User.order(:twitter_handle)
    role_badge = ->(u) { u.superadmin? ? " [superadmin]" : u.admin? ? " [admin]" : "" }

    rows = users.map do |u|
      <<~ROW
        <tr>
          <td style="padding:8px 12px">
            <a href="/auth/dev?user=#{u.twitter_handle}" style="color:#1d9bf0;text-decoration:none;font-weight:600">
              @#{u.twitter_handle}
            </a>#{role_badge.call(u)}
          </td>
          <td style="padding:8px 12px">#{u.display_name}</td>
          <td style="padding:8px 12px">#{u.reputation_score.round(1)}</td>
          <td style="padding:8px 12px">#{u.karma.round(0).to_i}</td>
          <td style="padding:8px 12px">#{u.can_write? ? "Yes" : "No"}</td>
          <td style="padding:8px 12px">#{u.can_rate? ? "Yes" : "No"}</td>
        </tr>
      ROW
    end.join

    render html: <<~HTML.html_safe
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dev Login Picker</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #0f1419; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p { color: #536471; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
          th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #cfd9de; color: #536471; font-size: 12px; text-transform: uppercase; }
          tr:hover { background: #f7f9f9; }
          td { border-bottom: 1px solid #eff3f4; }
        </style>
      </head>
      <body>
        <h1>Dev Login Picker</h1>
        <p>Click a user to log in as them via the extension.</p>
        <table>
          <thead><tr><th>Handle</th><th>Name</th><th>Rep</th><th>Karma</th><th>Can write</th><th>Can rate</th></tr></thead>
          <tbody>#{rows}</tbody>
        </table>
      </body>
      </html>
    HTML
  end

  # GET /auth/dev?user=handle — dev-only login
  # Pass ?user=handle to log in as an existing user (preserves DB reputation).
  # Without the param, creates/updates a default dev_tester account.
  def dev
    raise ActionController::RoutingError, "Not Found" unless Rails.env.development?

    if params[:user].present?
      user = User.find_by!(twitter_handle: params[:user])
    else
      user = User.find_or_initialize_by(twitter_uid: "dev_user")
      user.assign_attributes(
        twitter_handle: "dev_tester",
        display_name: "Dev Tester",
        avatar_url: "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png",
        follower_count: 500,
        account_created_at: 3.years.ago
      )
      user.save!
      user.recalculate_reputation!
    end

    redirect_to_extension(user)
  end

  def failure
    render json: { error: "Authentication failed", reason: params[:message] }, status: :unauthorized
  end

  private

  def redirect_to_extension(user)
    session[:auth_token] = user.auth_token

    # Render a page that stores the token and confirms login
    render html: <<~HTML.html_safe
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Successful — Community Notes Everywhere</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f7f9f9;
            color: #0f1419;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            background: #fff;
            border: 1px solid #e1e8ed;
            border-radius: 16px;
            padding: 48px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          }
          .checkmark {
            width: 56px;
            height: 56px;
            background: #00ba7c;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          }
          .checkmark svg { width: 28px; height: 28px; }
          h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
          .handle { color: #536471; font-size: 15px; margin: 0 0 24px; }
          .avatar {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            margin: 0 auto 16px;
            display: block;
          }
          .hint {
            color: #536471;
            font-size: 14px;
            margin: 0;
            line-height: 1.5;
          }
          .brand {
            color: #536471;
            font-size: 12px;
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #eff3f4;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="checkmark">
            <svg fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <img src="#{user.avatar_url}" alt="" class="avatar">
          <h1>You're logged in</h1>
          <p class="handle">@#{user.twitter_handle}</p>
          <p class="hint" id="status">You can close this tab and return to the extension.</p>
          <p class="brand">Community Notes Everywhere</p>
        </div>
        <script>
          const token = "#{user.auth_token}";
          const userData = {
            id: #{user.id},
            handle: "#{user.twitter_handle}",
            displayName: "#{user.display_name}",
            avatarUrl: "#{user.avatar_url}"
          };

          // The extension's background worker listens for this URL pattern
          // and reads the token from the hash fragment
          const hashData = encodeURIComponent(JSON.stringify({ token, user: userData }));
          window.location.hash = "cne_auth=" + hashData;
        </script>
      </body>
      </html>
    HTML
  end
end
