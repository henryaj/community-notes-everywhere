# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_11_141535) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "notes", force: :cascade do |t|
    t.bigint "author_id", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.string "css_selector"
    t.integer "helpful_count", default: 0, null: false
    t.integer "not_helpful_count", default: 0, null: false
    t.bigint "page_id", null: false
    t.text "selected_text", null: false
    t.integer "somewhat_count", default: 0, null: false
    t.boolean "sources_linked"
    t.integer "status", default: 0, null: false
    t.string "text_prefix"
    t.string "text_suffix"
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_notes_on_author_id"
    t.index ["page_id"], name: "index_notes_on_page_id"
  end

  create_table "pages", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "domain"
    t.string "title"
    t.datetime "updated_at", null: false
    t.string "url", null: false
    t.index ["domain"], name: "index_pages_on_domain"
    t.index ["url"], name: "index_pages_on_url", unique: true
  end

  create_table "ratings", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "helpfulness", null: false
    t.bigint "note_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["note_id"], name: "index_ratings_on_note_id"
    t.index ["user_id", "note_id"], name: "index_ratings_on_user_id_and_note_id", unique: true
    t.index ["user_id"], name: "index_ratings_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "account_created_at"
    t.string "auth_token"
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.string "display_name"
    t.integer "follower_count"
    t.float "karma", default: 0.0, null: false
    t.float "reputation_score", default: 0.0
    t.string "twitter_handle"
    t.string "twitter_uid", null: false
    t.datetime "updated_at", null: false
    t.index ["auth_token"], name: "index_users_on_auth_token", unique: true
    t.index ["twitter_uid"], name: "index_users_on_twitter_uid", unique: true
  end

  add_foreign_key "notes", "pages"
  add_foreign_key "notes", "users", column: "author_id"
  add_foreign_key "ratings", "notes"
  add_foreign_key "ratings", "users"
end
