# Seed data for Community Notes Everywhere
# Run with: bundle exec rails db:seed
# Idempotent — safe to run multiple times.

# -- Users --

author = User.find_or_create_by!(twitter_uid: "seed_author") do |u|
  u.twitter_handle = "seed_author"
  u.display_name = "Seed Author"
  u.reputation_score = 50.0
  u.karma = 9.0
end

raters = 3.times.map do |i|
  User.find_or_create_by!(twitter_uid: "seed_rater_#{i}") do |u|
    u.twitter_handle = "seed_rater_#{i}"
    u.display_name = "Seed Rater #{i}"
    u.reputation_score = 30.0
    u.karma = 0.0
  end
end

# Also set up the dev login user if not already present
User.find_or_create_by!(twitter_uid: "dev_user") do |u|
  u.twitter_handle = "dev_tester"
  u.display_name = "Dev Tester"
  u.follower_count = 500
  u.account_created_at = 3.years.ago
  u.reputation_score = 39.0
  u.karma = 0.0
end

dev_user = User.find_by(twitter_uid: "dev_user")
dev_user&.update!(role: :superadmin)

# Admin user for testing admin dashboard (not superadmin)
admin_user = User.find_or_create_by!(twitter_uid: "seed_admin") do |u|
  u.twitter_handle = "seed_admin"
  u.display_name = "Seed Admin"
  u.reputation_score = 40.0
  u.karma = 5.0
end
admin_user.update!(role: :admin)

# Low-rep user for testing gating
User.find_or_create_by!(twitter_uid: "seed_newbie") do |u|
  u.twitter_handle = "testuser"
  u.display_name = "Test User"
  u.reputation_score = 10.0
  u.karma = 0.0
end

# -- Notes on Paul Graham essays --

seed_notes = [
  {
    url: "https://paulgraham.com/gh.html",
    selected_text: "A great programmer might be ten or a hundred times as productive as an ordinary one, but he'll consider himself lucky to get paid three times as much.",
    body: "The \"10x programmer\" claim is widely debated. The original research (Sackman et al., 1968) measured a 28:1 ratio but had serious methodological flaws — it compared debugging time on different languages. Later studies (Prechelt 2000, McConnell 2011) find ratios closer to 4:1 on controlled tasks. https://www.construx.com/blog/productivity-variations-among-software-developers-and-teams-the-origin-of-10x/",
    text_prefix: "they're worth. ",
    text_suffix: "\n",
    sources_linked: true
  },
  {
    url: "https://paulgraham.com/gh.html",
    selected_text: "Of all the great programmers I can think of, I know of only one who would voluntarily program in Java.",
    body: "This was written in 2004. Since then, Java has evolved significantly (lambdas in Java 8, records and pattern matching in 14-21, virtual threads in 21). Many highly respected programmers now work in Java/JVM ecosystems by choice — notably Brian Goetz, Cay Horstmann, and the Kotlin/Clojure communities that target the JVM. https://openjdk.org/projects/amber/",
    text_prefix: "",
    text_suffix: " And of all the great programmers",
    sources_linked: true
  },
  {
    url: "https://paulgraham.com/say.html",
    selected_text: "I suspect the statements that make people maddest are those they worry might be true.",
    body: "This is a common rhetorical framing but it's not reliably true. Research on emotional reactions to speech (Tetlock 2003, \"Thinking the Unthinkable\") shows that people react most strongly to statements that violate sacred values — regardless of truth content. Anger at a claim doesn't tell you much about its validity. https://philpapers.org/rec/TETTTU",
    text_prefix: "",
    text_suffix: "\n",
    sources_linked: true
  }
]

seed_notes.each do |attrs|
  page = Page.find_or_create_for_url(attrs[:url])
  note = Note.find_or_create_by!(page: page, selected_text: attrs[:selected_text]) do |n|
    n.author = author
    n.body = attrs[:body]
    n.text_prefix = attrs[:text_prefix]
    n.text_suffix = attrs[:text_suffix]
    n.sources_linked = attrs[:sources_linked]
  end

  # Add 3 helpful ratings — except the first gh.html note, which stays unrated
  unless attrs[:url] == "https://paulgraham.com/gh.html" && attrs[:selected_text].start_with?("A great programmer")
    raters.each do |rater|
      Rating.find_or_create_by!(user: rater, note: note) do |r|
        r.helpfulness = :yes
      end
    end
  end

  note.reload
  puts "Note ##{note.id} on #{attrs[:url]}: status=#{note.status}, helpful=#{note.helpful_count}"
end

puts "\nSeed complete. Dev login: /auth/dev (rep ~39, anyone can rate)"
puts "Low-rep login: /auth/dev?user=testuser (rep 10, cannot rate or write)"
